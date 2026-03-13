import { CATEGORIES } from "../utils/constants.js";
import { debounce, clearChildren, createElement } from "../utils/dom.js";
import { deleteTemplate, getTemplates } from "../utils/storage.js";

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const templateList = document.getElementById("templateList");
const addButton = document.getElementById("addTemplate");
const openOptions = document.getElementById("openOptions");

let templates = [];

function buildCategoryOptions() {
  const allOption = createElement("option", { text: "All", attrs: { value: "" } });
  categoryFilter.appendChild(allOption);
  CATEGORIES.forEach((category) => {
    const option = createElement("option", { text: category, attrs: { value: category } });
    categoryFilter.appendChild(option);
  });
}

function filterTemplates() {
  const term = searchInput.value.trim().toLowerCase();
  const category = categoryFilter.value;
  return templates.filter((t) => {
    const matchesTerm =
      t.title.toLowerCase().includes(term) ||
      t.keyword.toLowerCase().includes(term) ||
      t.content.toLowerCase().includes(term);
    const matchesCategory = category ? t.category === category : true;
    return matchesTerm && matchesCategory;
  });
}

function renderList() {
  clearChildren(templateList);
  const filtered = filterTemplates();

  if (filtered.length === 0) {
    templateList.appendChild(createElement("div", { className: "empty", text: "No templates found" }));
    return;
  }

  filtered.forEach((template) => {
    const card = createElement("div", { className: "card" });
    const title = createElement("div", { className: "card-title", text: template.title });
    const meta = createElement("div", {
      className: "card-meta",
      text: `/${template.keyword} • ${template.category}`
    });
    const actions = createElement("div", { className: "card-actions" });
    const editBtn = createElement("button", { text: "Edit", className: "secondary" });
    const deleteBtn = createElement("button", { text: "Delete", className: "danger" });

    editBtn.addEventListener("click", () => {
      chrome.runtime.openOptionsPage();
    });

    deleteBtn.addEventListener("click", async () => {
      await deleteTemplate(template.id);
      await loadTemplates();
    });

    actions.append(editBtn, deleteBtn);
    card.append(title, meta, actions);
    templateList.appendChild(card);
  });
}

async function loadTemplates() {
  templates = await getTemplates();
  renderList();
}

const onSearch = debounce(renderList, 200);

searchInput.addEventListener("input", onSearch);
categoryFilter.addEventListener("change", renderList);
addButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());

buildCategoryOptions();
loadTemplates();
