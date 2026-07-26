import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';

interface FlowNode {
  id: string;
  type: 'start' | 'message' | 'question' | 'end';
  data: { text?: string };
}
interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

const MAX_HOPS = 10;

/**
 * Executes a Flow's nodes/edges against a lead's inbound message — the "off
 * switch" alternative to the freeform LangGraph agent. Only invoked when
 * BusinessSettings.agentMode is "FLOW"; see webhooks.service.ts call sites.
 */
@Injectable()
export class FlowRuntimeService {
  private readonly logger = new Logger(FlowRuntimeService.name);

  constructor(
    private prisma: PrismaService,
    private conversations: ConversationsService,
  ) {}

  /** Returns true if a flow handled this message, false if the caller should fall back to the AI agent. */
  async handleInbound(leadId: string, contactId: string, channel: string, text: string): Promise<boolean> {
    const flow = await this.pickFlow(text);
    if (!flow) return false;

    const nodes = (flow.nodes as unknown as FlowNode[]) || [];
    const edges = (flow.edges as unknown as FlowEdge[]) || [];
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    let progress = await this.prisma.flowProgress.findUnique({
      where: { leadId_flowId: { leadId, flowId: flow.id } },
    });

    let currentNodeId: string | null;
    if (!progress || progress.status !== 'active') {
      // Fresh start (first message ever, or restarting after a previous completion).
      const start = nodes.find(n => n.type === 'start');
      currentNodeId = start?.id ?? null;
      progress = await this.prisma.flowProgress.upsert({
        where: { leadId_flowId: { leadId, flowId: flow.id } },
        create: { leadId, flowId: flow.id, currentNodeId, status: 'active' },
        update: { currentNodeId, status: 'active' },
      });
    } else {
      // Waiting at a question node from a previous turn — match the reply against its options.
      const waitingNode = progress.currentNodeId ? nodeById.get(progress.currentNodeId) : undefined;
      if (waitingNode?.type === 'question') {
        const outgoing = edges.filter(e => e.source === waitingNode.id);
        const match = outgoing.find(e => (e.label || '').trim().toLowerCase() === text.trim().toLowerCase());
        if (!match) {
          // Didn't match any option — re-ask instead of derailing the script.
          await this.sendNode(leadId, contactId, channel, waitingNode, outgoing);
          return true;
        }
        currentNodeId = match.target;
      } else {
        currentNodeId = progress.currentNodeId;
      }
    }

    // Walk forward, auto-chaining plain "message" nodes, stopping to wait at a
    // "question" node or once the flow ends.
    let hops = 0;
    while (currentNodeId && hops++ < MAX_HOPS) {
      const node = nodeById.get(currentNodeId);
      if (!node) break;
      const outgoing = edges.filter(e => e.source === node.id);

      if (node.type === 'end') {
        if (node.data?.text) {
          await this.conversations.create({ text: node.data.text, channel, direction: 'OUTBOUND', leadId, contactId });
        }
        await this.prisma.flowProgress.update({ where: { id: progress.id }, data: { currentNodeId: null, status: 'completed' } });
        return true;
      }

      if (node.type === 'question') {
        await this.sendNode(leadId, contactId, channel, node, outgoing);
        await this.prisma.flowProgress.update({ where: { id: progress.id }, data: { currentNodeId: node.id } });
        return true;
      }

      // 'start' and 'message' nodes just send (if there's text) and continue.
      if (node.type === 'message' && node.data?.text) {
        await this.conversations.create({ text: node.data.text, channel, direction: 'OUTBOUND', leadId, contactId });
      }
      currentNodeId = outgoing[0]?.target ?? null;
    }

    await this.prisma.flowProgress.update({ where: { id: progress.id }, data: { currentNodeId } });
    return true;
  }

  private async sendNode(leadId: string, contactId: string, channel: string, node: FlowNode, outgoing: FlowEdge[]) {
    const options = outgoing
      .filter(e => e.label)
      .map(e => ({ id: e.label as string, title: e.label as string }));
    await this.conversations.create({
      text: node.data?.text || 'Choose an option:',
      channel, direction: 'OUTBOUND', leadId, contactId,
      metadata: options.length ? { options } : undefined,
    } as any);
  }

  private async pickFlow(text: string) {
    const lower = text.toLowerCase();
    const flows = await this.prisma.flow.findMany({ where: { active: true } });
    if (!flows.length) return null;
    const byKeyword = flows.find(f => f.triggerKeywords.some(k => lower.includes(k.toLowerCase())));
    return byKeyword || flows.find(f => f.isDefault) || flows[0];
  }
}
