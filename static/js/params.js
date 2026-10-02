const STORAGE_KEY = "quote_selected_state_v1";

const els = {
    paramsContainer: document.getElementById("paramsContainer"),
    generateBtn: document.getElementById("generateParamsImageBtn"),
    popupMask: document.getElementById("popupMask"),
    popupCloseBtn: document.getElementById("popupCloseBtn"),
    popupContent: document.getElementById("popupContent"),
};

const state = {
    categories: [],
    selections: {},
};

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

function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 1800);
}

function openPopup(html) {
    els.popupContent.innerHTML = html;
    els.popupMask.classList.remove("hidden");
}

function closePopup() {
    els.popupMask.classList.add("hidden");
    els.popupContent.innerHTML = "";
}

function loadSelectionsFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw);
        return parsed.selections || {};
    } catch (_e) {
        return {};
    }
}

function getSelectedItems() {
    const out = [];
    state.categories.forEach((category) => {
        const current = state.selections[category.id];
        const ids = category.selection_mode === "multi" ? (Array.isArray(current) ? current : []) : [Number(current || 0)];
        ids.forEach((id) => {
            if (!id) return;
            const option = category.options.find((x) => x.id === Number(id));
            if (!option) return;
            out.push({
                category_id: category.id,
                category_name: category.name,
                option_id: option.id,
                option_name: option.name,
                price: Number(option.price || 0),
                params: option.params || [],
            });
        });
    });
    return out;
}

function renderParams() {
    const items = getSelectedItems();
    if (items.length === 0) {
        els.paramsContainer.innerHTML = "<p>未检测到已选商品，请返回报价页先选择配置。</p>";
        return;
    }

    els.paramsContainer.innerHTML = items
        .map((item, index) => {
            const paramsHtml =
                item.params.length > 0
                    ? item.params.map((p) => `<tr><td>${p.key}</td><td>${p.value}</td></tr>`).join("")
                    : "<tr><td colspan='2'>该商品暂无参数</td></tr>";
            return `
                <article class="param-item">
                    <div class="param-title">${index + 1}. ${item.category_name}：${item.option_name}（¥${item.price.toFixed(2)}）</div>
                    <table>
                        <thead><tr><th>参数名</th><th>参数值</th></tr></thead>
                        <tbody>${paramsHtml}</tbody>
                    </table>
                </article>
            `;
        })
        .join("");
}

async function generateParamsImage() {
    const items = getSelectedItems();
    if (items.length === 0) {
        toast("请先在报价页选择商品");
        return;
    }
    try {
        const resp = await fetch(withBasePath("/api/parameter-image"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selections: state.selections }),
        });
        const data = await resp.json();
        data.image_url = withBasePath(data.image_url);
        if (!resp.ok || !data.ok) {
            throw new Error(data.message || "生成失败");
        }
        openPopup(`
            <h3>参数图片</h3>
            <img src="${data.image_url}" alt="参数图片" style="width:100%;border:1px solid #dbe4f6;border-radius:8px;">
        `);
    } catch (error) {
        toast(error.message || "请求失败");
    }
}

async function init() {
    state.selections = loadSelectionsFromStorage();
    try {
        const resp = await fetch(withBasePath("/api/config"));
        const data = await resp.json();
        state.categories = data.categories || [];
        renderParams();
    } catch (_e) {
        els.paramsContainer.innerHTML = "<p>配置加载失败，请刷新后重试。</p>";
    }
}

els.generateBtn.addEventListener("click", generateParamsImage);
els.popupCloseBtn.addEventListener("click", closePopup);
els.popupMask.addEventListener("click", (e) => {
    if (e.target === els.popupMask) closePopup();
});

init();
