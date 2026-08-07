# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Login flow >> shows landing page by default
- Location: login.spec.ts:4:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
Call log:
  - navigating to "http://localhost:3000/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Login flow', () => {
  4  |   test('shows landing page by default', async ({ page }) => {
> 5  |     await page.goto('/');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
  6  |     await expect(page.locator('h1')).toContainText('Your leads never');
  7  |   });
  8  | 
  9  |   test('navigates to login page', async ({ page }) => {
  10 |     await page.goto('/');
  11 |     await page.locator('text=Sign In').first().click();
  12 |     await expect(page.locator('text=Welcome back')).toBeVisible();
  13 |   });
  14 | 
  15 |   test('shows login page via hash route', async ({ page }) => {
  16 |     await page.goto('/#/login');
  17 |     await expect(page.locator('text=Welcome back')).toBeVisible();
  18 |   });
  19 | 
  20 |   test('login form has email and password fields', async ({ page }) => {
  21 |     await page.goto('/#/login');
  22 |     await expect(page.locator('input[type="email"]')).toBeVisible();
  23 |     await expect(page.locator('input[type="password"]')).toBeVisible();
  24 |     await expect(page.locator('button[type="submit"]')).toBeVisible();
  25 |   });
  26 | 
  27 |   test('shows error on invalid credentials', async ({ page }) => {
  28 |     await page.goto('/#/login');
  29 |     await page.fill('input[type="email"]', 'wrong@email.com');
  30 |     await page.fill('input[type="password"]', 'wrongpass');
  31 |     await page.click('button[type="submit"]');
  32 |     await expect(page.locator('text=Network error').or(page.locator('text=Invalid'))).toBeVisible({ timeout: 10000 });
  33 |   });
  34 | 
  35 |   test('shows error on empty form submission', async ({ page }) => {
  36 |     await page.goto('/#/login');
  37 |     await page.click('button[type="submit"]');
  38 |     await expect(page.locator('text=Welcome back')).toBeVisible();
  39 |   });
  40 | 
  41 |   test('login page has branding', async ({ page }) => {
  42 |     await page.goto('/#/login');
  43 |     await expect(page.locator('text=LeadAuto')).toBeVisible();
  44 |     await expect(page.locator('text=Sign in to your account')).toBeVisible();
  45 |   });
  46 | });
  47 | 
```