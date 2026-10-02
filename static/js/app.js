const state = {
    categories: [],
    settings: {},
    selections: {},
    quote: null,
    includeTax: true,
    quoteForm: null,
};

const STORAGE_KEY = "quote_selected_state_v3";

const QUOTE_FORM_FIELDS = [
    { key: "product_series", label: "产品系列" },
    { key: "unit_power", label: "机组功率" },
    { key: "quantity", label: "数量" },
    { key: "unit_price", label: "单价" },
    { key: "engine_brand", label: "发动机品类" },
    { key: "engine_model", label: "发动机型号" },
    { key: "engine_power", label: "发动机功率" },
    { key: "engine_emission", label: "发动机排放" },
    { key: "tank_type", label: "水箱" },
    { key: "alternator_type", label: "发电机类型" },
    { key: "alternator_model", label: "发电机型号" },
    { key: "alternator_power", label: "发电机功率" },
    { key: "alternator_shell", label: "机壳" },
    { key: "alternator_voltage", label: "电压" },
    { key: "alternator_frequency", label: "频率" },
    { key: "control_system", label: "控制系统" },
    { key: "base_type", label: "底座类型" },
    { key: "machine_color", label: "整机颜色" },
    { key: "optional_config", label: "增选配置", multiline: true },
    { key: "other_config", label: "其他", multiline: true },
    { key: "payment_term", label: "付款方式", multiline: true },
    { key: "warranty_term", label: "质保期", multiline: true },
    { key: "delivery_term", label: "交货期", multiline: true },
    { key: "validity_term", label: "有效期", multiline: true },
];

const els = {
    loadingText: document.getElementById("loadingText"),
    categoriesContainer: document.getElementById("categoriesContainer"),
    selectedCount: document.getElementById("selectedCount"),
    totalPrice: document.getElementById("totalPrice"),
    createQuoteBtn: document.getElementById("createQuoteBtn"),
    createContractBtn: document.getElementById("createContractBtn"),
    viewImageBtn: document.getElementById("viewImageBtn"),
    viewParamsBtn: document.getElementById("viewParamsBtn"),
    viewDeliveryBtn: document.getElementById("viewDeliveryBtn"),
    resultContent: document.getElementById("resultContent"),
    taxRadios: document.querySelectorAll("input[name='taxMode']"),
    popupMask: document.getElementById("popupMask"),
    popupCloseBtn: document.getElementById("popupCloseBtn"),
    popupContent: document.getElementById("popupContent"),
};

function escapeHtml(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function withColon(text) {
    const clean = String(text || "").trim();
    if (!clean) return "";
    return /[:：]\s*$/.test(clean) ? clean : `${clean}：`;
}

function toMoney(value) {
    return Number(value || 0).toLocaleString("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function getTaxRate() {
    const rate = Number(state.settings.tax_rate || 0.13);
    return Number.isFinite(rate) && rate >= 0 ? rate : 0.13;
}

function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1800);
}

function getBasePath() {
    const value = String(window.APP_BASE_PATH || "").trim();
    if (!value || value === "/") return "";
    return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withBasePath(path) {
    const value = String(path || "").trim();
    if (!value) return value;
    if (/^https?:\/\//i.test(value)) return value;
    const base = getBasePath();
    if (!base) return value;
    return `${base}${value.startsWith("/") ? value : `/${value}`}`;
}

function apiUrl(path) {
    return withBasePath(path);
}

function isWeChatBrowser() {
    return /micromessenger/i.test(navigator.userAgent || "");
}

function getShareConfig() {
    const base = window.APP_SHARE_CONFIG || {};
    return {
        title: String(base.title || document.title || "发电机组报价系统"),
        desc: String(base.desc || "在线选择配置，快速生成报价单。"),
        link: String(base.link || window.location.href.split("#")[0]),
        imgUrl: String(base.img_url || ""),
    };
}

function applyLegacyWeChatShare(shareData) {
    if (!window.wx) return;
    if (typeof window.wx.onMenuShareAppMessage === "function") {
        window.wx.onMenuShareAppMessage(shareData);
    }
    if (typeof window.wx.onMenuShareTimeline === "function") {
        window.wx.onMenuShareTimeline({
            title: shareData.title,
            link: shareData.link,
            imgUrl: shareData.imgUrl,
        });
    }
}

async function initWeChatShare() {
    if (!isWeChatBrowser() || !window.wx || !window.APP_WECHAT_APP_ID) {
        return;
    }

    const targetUrl = window.location.href.split("#")[0];
    try {
        const resp = await fetch(apiUrl(`/api/wechat/jssdk-config?url=${encodeURIComponent(targetUrl)}`));
        const data = await resp.json();
        if (!resp.ok || !data.ok || !data.config) {
            return;
        }

        const shareData = getShareConfig();
        window.wx.config({
            debug: false,
            ...data.config,
        });
        window.wx.ready(() => {
            if (typeof window.wx.updateAppMessageShareData === "function") {
                window.wx.updateAppMessageShareData(shareData);
            }
            if (typeof window.wx.updateTimelineShareData === "function") {
                window.wx.updateTimelineShareData({
                    title: shareData.title,
                    link: shareData.link,
                    imgUrl: shareData.imgUrl,
                });
            }
            applyLegacyWeChatShare(shareData);
        });
    } catch (_error) {
        // Ignore share init failures to avoid blocking the quotation flow.
    }
}

function openPopup(innerHtml) {
    els.popupContent.innerHTML = innerHtml;
    els.popupMask.classList.remove("hidden");
}

function closePopup() {
    els.popupMask.classList.add("hidden");
    els.popupContent.innerHTML = "";
}

function setButtonsDisabled(disabled) {
    els.createQuoteBtn.disabled = disabled;
    els.createContractBtn.disabled = disabled;
}

function getOptionById(category, optionId) {
    return category.options.find((item) => item.id === optionId);
}

function getSelectionsForCategory(category) {
    const raw = state.selections[category.id];
    if (category.selection_mode === "multi") {
        return Array.isArray(raw) ? raw.map((v) => Number(v)).filter((v) => v > 0) : [];
    }
    const selectedId = Number(raw || 0);
    return selectedId > 0 ? [selectedId] : [];
}

function getSelectedItems() {
    const result = [];
    state.categories.forEach((category) => {
        const ids = getSelectionsForCategory(category);
        ids.forEach((id) => {
            const option = getOptionById(category, id);
            if (!option) return;
            result.push({
                category_id: category.id,
                category_name: category.name,
                option_id: option.id,
                option_name: option.name,
                price: Number(option.price || 0),
                image_path: option.image_path || "",
                params: option.params || [],
            });
        });
    });
    return result;
}

function countSelectedItems() {
    return state.categories.reduce((count, category) => count + getSelectionsForCategory(category).length, 0);
}

function calcSubtotal() {
    return getSelectedItems().reduce((sum, item) => sum + Number(item.price || 0), 0);
}

function refreshSummary() {
    const subtotal = calcSubtotal();
    const tax = subtotal * getTaxRate();
    const total = state.includeTax ? subtotal + tax : subtotal;
    els.totalPrice.textContent = toMoney(total);
}

function persistSelectionSnapshot() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            selections: state.selections,
            includeTax: state.includeTax,
            updatedAt: Date.now(),
        })
    );
}

function restoreSelectionSnapshot() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
        const cache = JSON.parse(raw);
        state.selections = cache.selections || {};
        state.includeTax = cache.includeTax !== false;
    } catch (_e) {
        state.selections = {};
    }
}

function ensureSelectionDefaults() {
    state.categories.forEach((category) => {
        if (state.selections[category.id] !== undefined) return;
        if (category.selection_mode === "multi") {
            state.selections[category.id] = [];
            return;
        }
        if (category.required && category.options.length > 0) {
            state.selections[category.id] = category.options[0].id;
            return;
        }
        state.selections[category.id] = 0;
    });
}

function renderSingleCategory(category) {
    const row = document.createElement("div");
    row.className = "item-row";

    const label = document.createElement("div");
    label.className = "item-label";
    label.textContent = withColon(category.name);

    const input = document.createElement("div");
    input.className = "item-input";

    const select = document.createElement("select");
    select.className = "select-control";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = category.required ? "请选择" : "可不选";
    select.appendChild(placeholder);

    category.options.forEach((option) => {
        const opt = document.createElement("option");
        opt.value = String(option.id);
        opt.textContent = `${option.name}（¥${toMoney(option.price)}）`;
        select.appendChild(opt);
    });

    const selectedIds = getSelectionsForCategory(category);
    select.value = selectedIds.length > 0 ? String(selectedIds[0]) : "";

    select.addEventListener("change", () => {
        const optionId = Number(select.value || 0);
        state.selections[category.id] = optionId > 0 ? optionId : 0;
        state.quote = null;
        state.quoteForm = null;
        renderResult(null);
        refreshSummary();
        renderCategories();
        persistSelectionSnapshot();
    });

    input.appendChild(select);
    row.appendChild(label);
    row.appendChild(input);
    return row;
}

function renderMultiCategory(category) {
    const block = document.createElement("div");
    block.className = "option-block";

    const title = document.createElement("p");
    title.className = "option-title";
    title.textContent = withColon(category.name || "可选配置");
    block.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "option-grid";
    const selectedIds = new Set(getSelectionsForCategory(category));

    category.options.forEach((option) => {
        const label = document.createElement("label");
        label.className = "option-item";

        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = selectedIds.has(option.id);

        input.addEventListener("change", () => {
            const current = new Set(getSelectionsForCategory(category));
            if (input.checked) current.add(option.id);
            else current.delete(option.id);
            state.selections[category.id] = Array.from(current);
            state.quote = null;
            state.quoteForm = null;
            renderResult(null);
            refreshSummary();
            renderCategories();
            persistSelectionSnapshot();
        });

        const text = document.createElement("span");
        text.innerHTML = `${escapeHtml(option.name)} <span class="option-price">+¥${toMoney(option.price)}</span>`;

        label.appendChild(input);
        label.appendChild(text);
        grid.appendChild(label);
    });

    block.appendChild(grid);
    return block;
}

function renderCategories() {
    els.categoriesContainer.innerHTML = "";
    const singles = state.categories.filter((category) => category.selection_mode !== "multi");
    const multis = state.categories.filter((category) => category.selection_mode === "multi");

    singles.forEach((category) => {
        els.categoriesContainer.appendChild(renderSingleCategory(category));
    });

    multis.forEach((category) => {
        els.categoriesContainer.appendChild(renderMultiCategory(category));
    });

    els.selectedCount.textContent = `已选 ${countSelectedItems()} 项`;
}

function renderResult(quote) {
    if (!quote) {
        els.resultContent.className = "result-empty";
        els.resultContent.textContent = "请选择配置后点击“生成报价单”";
        return;
    }

    els.resultContent.className = "result-card";
    els.resultContent.innerHTML = `
        <div class="result-head">
            <div>报价编号：<strong>${escapeHtml(quote.quote_no)}</strong></div>
            <div class="result-total">总价：¥${toMoney(quote.total)}</div>
        </div>
        <div class="result-date">生成时间：${escapeHtml(quote.created_at || "")}</div>
        <div class="result-actions">
            <button type="button" id="openQuotationEditorBtn">编辑后生成报价单图片</button>
            <button type="button" id="openContractBtn">查看合同图片</button>
        </div>
    `;

    const quoteBtn = document.getElementById("openQuotationEditorBtn");
    const contractBtn = document.getElementById("openContractBtn");

    if (quoteBtn) {
        quoteBtn.addEventListener("click", async () => {
            await openQuotationFormPopup(quote);
        });
    }
    if (contractBtn) {
        contractBtn.addEventListener("click", async () => {
            await showContractPopup(quote.contract_image_url);
        });
    }
}

function collectPayload() {
    return {
        selections: state.selections,
        include_tax: state.includeTax,
    };
}

function normalizeQuoteForm(raw = {}) {
    const normalized = {};
    QUOTE_FORM_FIELDS.forEach((field) => {
        normalized[field.key] = String(raw[field.key] || "").trim();
    });
    if (!normalized.quantity || Number(normalized.quantity) <= 0) {
        normalized.quantity = "1";
    }
    if (!normalized.unit_price) {
        normalized.unit_price = String(calcSubtotal().toFixed(2));
    }
    return normalized;
}

function buildQuoteFormPopupHtml(formData) {
    const rows = QUOTE_FORM_FIELDS.map((field) => {
        const value = escapeHtml(formData[field.key] || "");
        if (field.multiline) {
            return `
                <label class="quote-form-row">
                    <span class="quote-form-label">${escapeHtml(field.label)}：</span>
                    <textarea class="quote-form-textarea" name="${field.key}" rows="2">${value}</textarea>
                </label>
            `;
        }
        return `
            <label class="quote-form-row">
                <span class="quote-form-label">${escapeHtml(field.label)}：</span>
                <input class="quote-form-input" name="${field.key}" value="${value}" />
            </label>
        `;
    }).join("");

    return `
        <div class="quote-form-panel">
            <h3 class="quote-form-title">发电机组报价单</h3>
            <p class="quote-form-tip">以下绿色方框标注的内容都可以修改</p>
            <form id="quoteFormEditor" class="quote-form-body">
                ${rows}
                <button type="submit" id="quoteFormSubmitBtn" class="quote-form-submit">生成报价单图片</button>
            </form>
        </div>
    `;
}

function readQuoteFormFromDom(formEl) {
    const fd = new FormData(formEl);
    const form = {};
    QUOTE_FORM_FIELDS.forEach((field) => {
        form[field.key] = String(fd.get(field.key) || "").trim();
    });
    return normalizeQuoteForm(form);
}

async function fetchContractImage(contractApiUrl) {
    const resp = await fetch(withBasePath(contractApiUrl));
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
        throw new Error(data.message || "合同图片生成失败");
    }
    return withBasePath(data.image_url);
}

async function generateQuotationImage(quoteId, formData) {
    const resp = await fetch(apiUrl(`/api/quotes/${quoteId}/quotation-image`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: formData }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.ok) {
        throw new Error(data.message || "报价单图片生成失败");
    }
    return data;
}

async function showContractPopup(contractApiUrl) {
    const imageUrl = await fetchContractImage(contractApiUrl);
    openPopup(`
        <h3>合同图片</h3>
        <img class="contract-preview" src="${escapeHtml(imageUrl)}" alt="合同图片">
    `);
}

function showQuotationImagePopup(imageUrl) {
    openPopup(`
        <h3>报价单图片</h3>
        <img class="contract-preview" src="${escapeHtml(withBasePath(imageUrl))}" alt="报价单图片">
    `);
}

async function openQuotationFormPopup(quote) {
    if (!quote || !quote.quote_id) {
        toast("请先生成报价");
        return;
    }

    const formData = normalizeQuoteForm(state.quoteForm || quote.quotation_form || {});
    openPopup(buildQuoteFormPopupHtml(formData));

    const formEl = document.getElementById("quoteFormEditor");
    const submitBtn = document.getElementById("quoteFormSubmitBtn");
    if (!formEl || !submitBtn) return;

    formEl.addEventListener("submit", async (event) => {
        event.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "生成中...";
        try {
            const payload = readQuoteFormFromDom(formEl);
            const result = await generateQuotationImage(quote.quote_id, payload);
            state.quoteForm = normalizeQuoteForm(result.form || payload);
            showQuotationImagePopup(result.image_url);
        } catch (error) {
            toast(error.message || "生成失败");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "生成报价单图片";
        }
    });
}

async function createQuote(mode) {
    if (getSelectedItems().length === 0) {
        toast("请先选择配置");
        return;
    }

    setButtonsDisabled(true);
    try {
        const resp = await fetch(apiUrl("/api/quotes"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(collectPayload()),
        });
        const data = await resp.json();
        if (!resp.ok || !data.ok) {
            throw new Error(data.message || "生成失败");
        }

        state.quote = data;
        state.quoteForm = normalizeQuoteForm(data.quotation_form || {});
        renderResult(data);
        persistSelectionSnapshot();
        toast("报价生成成功");

        if (mode === "quotation") {
            await openQuotationFormPopup(data);
        } else if (mode === "contract") {
            await showContractPopup(data.contract_image_url);
        }
    } catch (error) {
        toast(error.message || "请求失败");
    } finally {
        setButtonsDisabled(false);
    }
}

function bindQuickActions() {
    els.viewParamsBtn.addEventListener("click", () => {
        persistSelectionSnapshot();
        window.location.href = withBasePath("/params");
    });

    els.viewImageBtn.addEventListener("click", () => {
        const items = getSelectedItems().filter((item) => item.image_path);
        if (items.length === 0) {
            toast("当前所选商品暂无图片");
            return;
        }

        const html = `
            <h3>所选商品图片</h3>
            <div class="image-grid">
                ${items
                    .map(
                        (item) => `
                        <div>
                            <p class="image-item-title">${escapeHtml(item.category_name)}：${escapeHtml(item.option_name)}</p>
                            <img src="${escapeHtml(withBasePath(item.image_path))}" alt="${escapeHtml(item.option_name)}">
                        </div>
                    `
                    )
                    .join("")}
            </div>
        `;
        openPopup(html);
    });

    els.viewDeliveryBtn.addEventListener("click", () => {
        const delivery = escapeHtml(state.settings.delivery_term || "请在后台配置货期说明");
        openPopup(`<h3>货期说明</h3><p>${delivery}</p>`);
    });

    els.createContractBtn.addEventListener("click", () => {
        createQuote("contract");
    });
}

function bindTaxSwitch() {
    els.taxRadios.forEach((radio) => {
        radio.addEventListener("change", () => {
            state.includeTax = radio.value === "include";
            refreshSummary();
            persistSelectionSnapshot();
        });
    });
}

function syncTaxRadio() {
    const target = state.includeTax ? "include" : "exclude";
    const match = Array.from(els.taxRadios).find((radio) => radio.value === target);
    if (match) match.checked = true;
}

async function init() {
    try {
        const resp = await fetch(apiUrl("/api/config"));
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.message || "配置加载失败");
        }

        state.categories = data.categories || [];
        state.settings = data.settings || {};

        restoreSelectionSnapshot();
        ensureSelectionDefaults();
        syncTaxRadio();

        els.loadingText.style.display = "none";
        renderCategories();
        refreshSummary();
        bindTaxSwitch();
        bindQuickActions();
        renderResult(null);
        initWeChatShare();
    } catch (error) {
        els.loadingText.textContent = "配置加载失败，请刷新后重试";
        toast(error.message || "配置加载失败");
    }
}

els.createQuoteBtn.addEventListener("click", () => createQuote("quotation"));
els.popupCloseBtn.addEventListener("click", closePopup);
els.popupMask.addEventListener("click", (event) => {
    if (event.target === els.popupMask) {
        closePopup();
    }
});

init();
