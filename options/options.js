import { CATEGORIES } from "../utils/constants.js";
import { createElement, clearChildren, debounce } from "../utils/dom.js";
import {
  addTemplate,
  deleteTemplate,
  getTemplates,
  updateTemplate,
  isKeywordTaken
} from "../utils/storage.js";

const searchInput = document.getElementById("searchInput");
const categoryFilter = document.getElementById("categoryFilter");
const templateList = document.getElementById("templateList");
const newTemplateBtn = document.getElementById("newTemplate");
const dialog = document.getElementById("templateDialog");
const form = document.getElementById("templateForm");
const formTitle = document.getElementById("formTitle");
const formError = document.getElementById("formError");
const richEditor = document.getElementById("richEditor");
const toolbar = dialog.querySelector(".toolbar");
const insertImageBtn = document.getElementById("insertImage");
const uploadImageInput = document.getElementById("uploadImage");

let templates = [];
let editingId = null;

function buildCategoryOptions() {
  const allOption = createElement("option", { text: "All", attrs: { value: "" } });
  categoryFilter.appendChild(allOption);
  CATEGORIES.forEach((category) => {
    const option = createElement("option", { text: category, attrs: { value: category } });
    categoryFilter.appendChild(option);
  });

  const categorySelect = form.elements["category"];
  CATEGORIES.forEach((category) => {
    const option = createElement("option", { text: category, attrs: { value: category } });
    categorySelect.appendChild(option);
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
    const preview = createElement("div", { className: "card-meta" });
  const textPreview = template.content.replace(/<[^>]*>/g, "");
  preview.textContent = textPreview.length > 120 ? textPreview.slice(0, 120) + "..." : textPreview;
    const actions = createElement("div", { className: "card-actions" });
    const editBtn = createElement("button", { text: "Edit", className: "secondary" });
    const deleteBtn = createElement("button", { text: "Delete", className: "danger" });

    editBtn.addEventListener("click", () => openEditor(template));
    deleteBtn.addEventListener("click", async () => {
      await deleteTemplate(template.id);
      await loadTemplates();
    });

    actions.append(editBtn, deleteBtn);
    card.append(title, meta, preview, actions);
    templateList.appendChild(card);
  });
}

async function loadTemplates() {
  templates = await getTemplates();
  renderList();
}

function openEditor(template = null) {
  form.reset();
  formError.textContent = "";

  if (template) {
    editingId = template.id;
    formTitle.textContent = "Edit Template";
    form.elements["title"].value = template.title;
    form.elements["keyword"].value = template.keyword;
    form.elements["category"].value = template.category;
    richEditor.innerHTML = template.content;
  } else {
    editingId = null;
    formTitle.textContent = "New Template";
    form.elements["category"].value = CATEGORIES[0];
    richEditor.innerHTML = "";
  }

  dialog.showModal();
}

async function handleSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  const keyword = data.keyword.trim().toLowerCase();

  if (!keyword) {
    formError.textContent = "Keyword is required";
    return;
  }

  const taken = await isKeywordTaken(keyword, editingId);
  if (taken) {
    formError.textContent = "Keyword already exists. Use a different keyword.";
    return;
  }

  const contentHtml = richEditor.innerHTML.trim();
  if (!contentHtml) {
    formError.textContent = "Content is required";
    return;
  }

  const template = {
    id: editingId || crypto.randomUUID(),
    title: data.title.trim(),
    keyword,
    category: data.category,
    content: contentHtml,
    createdAt: editingId ? templates.find((t) => t.id === editingId)?.createdAt || Date.now() : Date.now()
  };

  if (editingId) {
    await updateTemplate(template);
  } else {
    await addTemplate(template);
  }

  dialog.close();
  await loadTemplates();
}

const onSearch = debounce(renderList, 200);

searchInput.addEventListener("input", onSearch);
categoryFilter.addEventListener("change", renderList);
newTemplateBtn.addEventListener("click", () => openEditor());
form.addEventListener("submit", handleSubmit);
form.addEventListener("reset", () => {
  richEditor.innerHTML = "";
});

dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

toolbar.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !button.dataset.cmd) return;
  document.execCommand(button.dataset.cmd, false, null);
  richEditor.focus();
});

toolbar.addEventListener("change", (event) => {
  const target = event.target;
  if (!target.dataset.cmd) return;
  document.execCommand(target.dataset.cmd, false, target.value);
  richEditor.focus();
});

insertImageBtn.addEventListener("click", () => {
  const url = prompt("Image URL");
  if (url) {
    document.execCommand("insertImage", false, url);
    richEditor.focus();
  }
});

uploadImageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    document.execCommand("insertImage", false, reader.result);
    richEditor.focus();
    uploadImageInput.value = "";
  };
  reader.readAsDataURL(file);
});

buildCategoryOptions();
loadTemplates();
