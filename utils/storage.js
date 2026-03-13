import { STORAGE_KEY } from "./constants.js";

const sortByCreatedAtDesc = (a, b) => b.createdAt - a.createdAt;

export async function getTemplates() {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const templates = result[STORAGE_KEY] || [];
  return templates.sort(sortByCreatedAtDesc);
}

export async function saveTemplates(templates) {
  await chrome.storage.local.set({ [STORAGE_KEY]: templates });
}

export async function addTemplate(template) {
  const templates = await getTemplates();
  templates.push(template);
  await saveTemplates(templates);
}

export async function updateTemplate(updated) {
  const templates = await getTemplates();
  const index = templates.findIndex((t) => t.id === updated.id);
  if (index === -1) return false;
  templates[index] = updated;
  await saveTemplates(templates);
  return true;
}

export async function deleteTemplate(id) {
  const templates = await getTemplates();
  const filtered = templates.filter((t) => t.id !== id);
  await saveTemplates(filtered);
}

export async function isKeywordTaken(keyword, excludeId = null) {
  const templates = await getTemplates();
  const lower = keyword.trim().toLowerCase();
  return templates.some((t) => t.keyword.toLowerCase() === lower && t.id !== excludeId);
}
