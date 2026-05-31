import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

async function navigateToConfig(page) {
  const tabConfigBtn = page.locator('#tabConfigBtn');
  await tabConfigBtn.click();
  await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });
}

test.describe('Configuration Tab', () => {
  test('should display LLM Configuration section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const configTitle = page.locator('text=Configuration LLM');
      await expect(configTitle).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Provider dropdown', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const providerSelect = page.locator('#provider');
      await expect(providerSelect).toBeVisible();

      // Check for some known providers
      const options = page.locator('#provider option');
      const count = await options.count();
      expect(count).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have API Key input field', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const apiKeyInput = page.locator('#apiKey');
      await expect(apiKeyInput).toBeVisible();
      await expect(apiKeyInput).toHaveAttribute('type', 'password');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have API URL input field', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      // Open advanced settings details section
      const detailsSection = page.locator('details').first();
      await detailsSection.click();
      await page.waitForTimeout(200);

      const apiUrlInput = page.locator('#apiUrl');
      await expect(apiUrlInput).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Model Name input field', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      // Model Name input exists in DOM but may be hidden by default
      // It only shows when custom provider is selected
      const modelInput = page.locator('#modelName');
      expect(await modelInput.count()).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Dead Links checkbox', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      // #checkDeadLinks is in the Rangement tab, not Config
      const deadLinksCheckbox = page.locator('#checkDeadLinks');
      await expect(deadLinksCheckbox).toHaveAttribute('type', 'checkbox');
      expect(await deadLinksCheckbox.count()).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Save Configuration button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const saveBtn = page.locator('#btnSaveConfig');
      await expect(saveBtn).toBeVisible();
      expect(await saveBtn.textContent()).toContain('Enregistrer');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Reset Configuration button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const resetBtn = page.locator('#btnResetConfig');
      await expect(resetBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Export Configuration button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const exportBtn = page.locator('#btnExportConfig');
      await expect(exportBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Import Configuration button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const importBtn = page.locator('#btnImportConfig');
      await expect(importBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Fetch Models button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const fetchBtn = page.locator('#btnFetchModels');
      await expect(fetchBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Advanced Settings section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const advancedSection = page.locator('text=Paramètres avancés').first();
      await expect(advancedSection).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Batch Size selector', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      // Open advanced settings details section
      const detailsSection = page.locator('details').first();
      await detailsSection.click();
      await page.waitForTimeout(200);

      const batchSelect = page.locator('#linkCheckBatchSize');
      await expect(batchSelect).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should allow provider selection change', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const providerSelect = page.locator('#provider');
      // Note: initial value not checked — we only assert the new selection

      // Select different provider if available
      await providerSelect.selectOption('openai');
      const newValue = await providerSelect.inputValue();

      expect(newValue).toBe('openai');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have prompt customization section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToConfig(page);

      const promptSection = page.locator('text=Personnaliser les prompts');
      await expect(promptSection).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});
