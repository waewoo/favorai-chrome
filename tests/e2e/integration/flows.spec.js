import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('End-to-End Integration Flows', () => {

  // Helper to clear existing bookmarks under Bookmarks Bar (id: '1')
  async function clearBookmarksBar(page) {
    await page.evaluate(async () => {
      const bar = await chrome.bookmarks.getChildren('1');
      for (const child of bar) {
        await chrome.bookmarks.removeTree(child.id);
      }
    });
  }

  // Helper to seed bookmarks structure under parentId
  async function seedBookmarks(page, parentId, items) {
    return await page.evaluate(async ({ parentId, items }) => {
      const createdNodes = [];
      async function createNodes(currentParentId, children) {
        for (const item of children) {
          if (item.url) {
            const node = await chrome.bookmarks.create({
              parentId: currentParentId,
              title: item.title,
              url: item.url
            });
            createdNodes.push({ ...item, realId: node.id });
          } else {
            const folder = await chrome.bookmarks.create({
              parentId: currentParentId,
              title: item.title
            });
            createdNodes.push({ ...item, realId: folder.id });
            if (item.children) {
              await createNodes(folder.id, item.children);
            }
          }
        }
      }
      await createNodes(parentId, items);
      return createdNodes;
    }, { parentId, items });
  }

  // Helper to retrieve the current bookmark tree structure
  async function getBookmarksTree(page) {
    return await page.evaluate(async () => {
      const tree = await chrome.bookmarks.getTree();
      const list = [];
      function traverse(node, path = '') {
        const currentPath = path ? `${path} > ${node.title}` : node.title;
        list.push({ id: node.id, parentId: node.parentId, title: node.title, url: node.url, path: currentPath });
        if (node.children) {
          node.children.forEach(child => traverse(child, currentPath));
        }
      }
      if (tree[0]) {
        traverse(tree[0]);
      }
      return list;
    });
  }

  test('Flow 1: End-to-End Bookmark Reorganization with Mocked LLM', async () => {
    const { context: extContext, page, extensionId, tmpDir } = await launchExtension();

    let cssTricksId = '';
    let stackOverflowId = '';

    // Intercept Google Gemini API calls on the correct extension context
    let apiCalled = false;
    await extContext.route('**/generativelanguage.googleapis.com/**', async (route) => {
      apiCalled = true;
      const requestBody = route.request().postData();
      expect(requestBody).toContain('CSS Tricks');
      
      expect(cssTricksId).not.toBe('');
      expect(stackOverflowId).not.toBe('');
      
      const responseJson = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    reorganizedTree: {
                      id: '1',
                      title: 'Barre de favoris',
                      children: [
                        {
                          id: 'new_dev_resources',
                          title: 'Developer Resources',
                          children: [
                            { id: cssTricksId },
                            { id: stackOverflowId }
                          ]
                        }
                      ]
                    },
                    explanation: 'Grouping development tools into Developer Resources.'
                  })
                }
              ]
            }
          }
        ]
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseJson)
      });
    });

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // 1. Seed initial bookmarks
      await clearBookmarksBar(page);
      const seeded = await seedBookmarks(page, '1', [
        { title: 'CSS Tricks', url: 'https://css-tricks.com' },
        { title: 'Stack Overflow', url: 'https://stackoverflow.com' }
      ]);
      expect(seeded.length).toBe(2);

      const cssTricksNode = seeded.find(n => n.title === 'CSS Tricks');
      const stackOverflowNode = seeded.find(n => n.title === 'Stack Overflow');
      cssTricksId = cssTricksNode.realId;
      stackOverflowId = stackOverflowNode.realId;

      // 2. Configure provider to Google Gemini
      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });
      await page.locator('#provider').selectOption('google');
      await page.locator('#apiKey').fill('mock-api-key');
      await page.locator('#btnSaveConfig').click();
      await page.waitForTimeout(300);

      // 3. Launch Reorganization
      const tabRangementBtn = page.locator('#tabRangementBtn');
      await tabRangementBtn.click();
      await page.locator('#tabRangementPanel').waitFor({ state: 'visible' });
      
      // Ensure network checks are unchecked for speed
      for (const id of ['checkDeadLinks', 'checkRedirects', 'checkContentDuplicates']) {
        const el = page.locator(`#${id}`);
        if (await el.isChecked()) await el.uncheck();
      }

      // Select Complete mode then launch
      await page.locator('input[name="reorgMode"][value="complete"]').check();
      await page.locator('#btnLaunch').click();

      // 4. Verify transition to validation view
      const validationView = page.locator('#validationView');
      await expect(validationView).toBeVisible({ timeout: 15000 });

      // Verify validation elements list
      const actionsContainer = page.locator('#actionListContainer');
      await expect(actionsContainer).toBeVisible();
      
      // Verify explanation rendering
      const explanationBlock = page.locator('#explanationBlock');
      await expect(explanationBlock).toContainText('Grouping development tools');

      // 5. Confirm and Apply changes
      await page.locator('#btnApply').click();
      
      // Click confirm on custom confirm modal
      const modal = page.locator('#confirmModal');
      await expect(modal).toBeVisible();
      await page.locator('#modalBtnConfirm').click();

      // 6. Verify view reverts back to mainView
      const mainView = page.locator('#mainView');
      await expect(mainView).toBeVisible({ timeout: 10000 });

      // 7. Verify browser actual bookmarks tree state
      expect(apiCalled).toBe(true);
      const tree = await getBookmarksTree(page);
      
      // Should contain "Developer Resources" folder
      const devResourcesFolder = tree.find(n => n.title === 'Developer Resources' && !n.url);
      expect(devResourcesFolder).toBeDefined();

      // CSS Tricks and Stack Overflow should be children of Developer Resources
      const cssTricks = tree.find(n => n.title === 'CSS Tricks');
      const stackOverflow = tree.find(n => n.title === 'Stack Overflow');
      expect(cssTricks.parentId).toBe(devResourcesFolder.id);
      expect(stackOverflow.parentId).toBe(devResourcesFolder.id);

    } finally {
      await cleanup(extContext, tmpDir);
    }
  });

  test('Flow 2: History Rollback of Bookmark Moves', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // 1. Seed initial bookmark under parentId '1' (Bookmarks Bar)
      await clearBookmarksBar(page);
      const seeded = await seedBookmarks(page, '1', [
        { title: 'GitHub Repo', url: 'https://github.com' }
      ]);
      const githubId = seeded[0].realId;

      // 2. Perform the simulated reorganization move (move GitHub to '2' - Other Bookmarks)
      await page.evaluate(async (id) => {
        await chrome.bookmarks.move(id, { parentId: '2' });
      }, githubId);

      // Verify it is indeed under '2'
      let tree = await getBookmarksTree(page);
      let githubNode = tree.find(n => n.id === githubId);
      expect(githubNode.parentId).toBe('2');

      // 3. Write a session rollback history log into chrome.storage.local
      await page.evaluate(async (id) => {
        const historyEntry = {
          id: 'sess_e2e_rollback_test',
          timestamp: Date.now(),
          mode: 'complete',
          explanation: 'Simulated Move Rollback E2E Test',
          entries: [{
            id: 'entry_test_1',
            type: 'move',
            nodeId: id,
            oldParentId: '1',
            title: 'GitHub Repo',
            sourcePath: 'Barre de favoris',
            targetPath: 'Autres favoris'
          }]
        };
        await chrome.storage.local.set({ reorgHistory: [historyEntry] });
      }, githubId);

      // 4. Open History tab and verify session card is rendered
      const tabHistoryBtn = page.locator('#tabHistoryBtn');
      await tabHistoryBtn.click();
      await page.locator('#tabHistoryPanel').waitFor({ state: 'visible' });

      const historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toContainText('Simulated Move Rollback E2E Test');

      // 5. Trigger the rollback
      const rollbackBtn = historyContainer.locator('.btn-rollback');
      await rollbackBtn.click();

      // Confirm in confirmModal
      const modal = page.locator('#confirmModal');
      await expect(modal).toBeVisible();
      await page.locator('#modalBtnConfirm').click();

      // 6. Verify toast notification showing success
      const toast = page.locator('#toast');
      await expect(toast).toBeVisible();

      // 7. Verify bookmark is moved back to parentId '1' (Bookmarks Bar)
      tree = await getBookmarksTree(page);
      githubNode = tree.find(n => n.id === githubId);
      expect(githubNode.parentId).toBe('1');

    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('Flow 3: Popup Light AI Suggested Placement & Save', async () => {
    const { context: extContext, page, extensionId, tmpDir } = await launchExtension();

    // Intercept Google Gemini API calls for suggestion on the correct context
    await extContext.route('**/generativelanguage.googleapis.com/**', async (route) => {
      const responseJson = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    action: 'create_new',
                    newFolderTitle: 'Tech News',
                    newFolderParentId: '1',
                    explanation: 'Creates a new tech news category folder.'
                  })
                }
              ]
            }
          }
        ]
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseJson)
      });
    });

    try {
      // 1. Mock extension active tab retrieval to return a target HTTP tab
      await page.addInitScript(() => {
        chrome.tabs.query = (queryInfo, callback) => {
          callback([{
            id: 888,
            title: 'Hacker News',
            url: 'https://news.ycombinator.com/'
          }]);
        };
        chrome.windows.getLastFocused = (queryInfo, callback) => {
          callback({ id: 100 });
        };
      });

      // 2. Navigate to Popup Light first to establish the extension origin
      await gotoPopup(page, extensionId, 'popup-light.html');
      await page.waitForTimeout(300);

      // 3. Clear any existing bookmarks & save Gemini credentials in local storage
      await clearBookmarksBar(page);
      await page.evaluate(async () => {
        await chrome.storage.sync.set({
          provider: 'google',
          modelName: 'gemini-1.5-flash'
        });
        await chrome.storage.local.set({
          apiKey: 'mock-gemini-key'
        });
      });

      // 4. Reload the page to refresh UI and state
      await page.reload();
      await page.waitForTimeout(500);

      // Verify the active tab metadata is successfully read
      const lightTitleInput = page.locator('#lightBookmarkTitle');
      expect(await lightTitleInput.inputValue()).toBe('Hacker News');
      await expect(page.locator('#lightTabUrl')).toHaveText('https://news.ycombinator.com/');

      // 5. Click Suggest Folder ("Trouver un emplacement")
      const btnAnalyze = page.locator('#btnLightAnalyze');
      await expect(btnAnalyze).toBeEnabled();
      await btnAnalyze.click();

      // 6. Verify suggestion card displays
      const suggestionCard = page.locator('#lightSuggestionCard');
      await expect(suggestionCard).toBeVisible();
      
      // Note: 'lightFolderLabel' is hardcoded as 'Nouveau dossier' in popup-light.js for create_new action
      await expect(page.locator('#lightFolderLabel')).toHaveText('Nouveau dossier');
      await expect(page.locator('#lightFolderPath')).toContainText('Tech News');
      await expect(page.locator('#lightSuggestionReason')).toHaveText('Creates a new tech news category folder.');

      // 7. Confirm suggestion
      const btnConfirm = page.locator('#btnLightConfirm');
      await expect(btnConfirm).toBeVisible();
      await btnConfirm.click();

      // 8. Verify bookmark was created under "Tech News" folder
      const tree = await getBookmarksTree(page);
      const techNewsFolder = tree.find(n => n.title === 'Tech News' && !n.url);
      expect(techNewsFolder).toBeDefined();

      const hnBookmark = tree.find(n => n.title === 'Hacker News' && n.url === 'https://news.ycombinator.com/');
      expect(hnBookmark).toBeDefined();
      expect(hnBookmark.parentId).toBe(techNewsFolder.id);

    } finally {
      await cleanup(extContext, tmpDir);
    }
  });

});
