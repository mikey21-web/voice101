import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { IWorkflowAction } from './workflow-action.interface';
import { SendMessageAction } from './send-message.action';
import { HttpRequestAction } from './http-request.action';
import { DelayAction } from './delay.action';
import { ConditionAction } from './condition.action';
import { CreateRecordAction } from './create-record.action';
import { UpdateRecordAction } from './update-record.action';
import { CodeAction } from './code.action';

@Injectable()
export class WorkflowActionFactory {
  private registry = new Map<string, IWorkflowAction>();

  constructor(
    private moduleRef: ModuleRef,
    private sendMessage: SendMessageAction,
    private httpRequest: HttpRequestAction,
    private delay: DelayAction,
    private condition: ConditionAction,
    private createRecord: CreateRecordAction,
    private updateRecord: UpdateRecordAction,
    private code: CodeAction,
  ) {
    this.register(this.sendMessage);
    this.register(this.httpRequest);
    this.register(this.delay);
    this.register(this.condition);
    this.register(this.createRecord);
    this.register(this.updateRecord);
    this.register(this.code);
  }

  private register(action: IWorkflowAction) {
    this.registry.set(action.type, action);
  }

  get(type: string): IWorkflowAction | undefined {
    return this.registry.get(type);
  }
}
