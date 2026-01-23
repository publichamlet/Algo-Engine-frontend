// ============================================================================
// UI Options + Dynamic Strategy Params (JSON driven)
// ============================================================================

const UI_OPTIONS_PATH = "./config/ui-options.json";
let UI_CFG = null; // cached in-memory config

function applyRequired(el, required) {
    if (!el) return;
    if (required) el.setAttribute("required", "required");
    else el.removeAttribute("required");
}

function fillSelect(selectId, items) {
    const el = document.getElementById(selectId);
    if (!el) return;

    el.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "-- Select --";
    opt0.disabled = true;
    opt0.selected = true;
    el.appendChild(opt0);

    let defaultValue = "";

    (items || []).forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = item.label || item.id;
        el.appendChild(opt);

        if (item.default === true) defaultValue = item.id;
    });

    if (defaultValue) el.value = defaultValue;
}

function fillInstrumentField(cfg) {
    const el = document.getElementById("instrument");
    if (!el) return;

    const isSelect = el.tagName.toLowerCase() === "select";
    if (isSelect) {
        fillSelect("instrument", cfg.instruments || []);
        return;
    }

    const instrumentCfg = (cfg.fields && cfg.fields.instrument) ? cfg.fields.instrument : {};
    const uppercase = instrumentCfg.uppercase === true;

    // Input uppercase enforcement (value + visual)
    if (uppercase) {
        el.style.textTransform = "uppercase";
        el.addEventListener("input", () => {
            el.value = el.value.toUpperCase();
        });
    }

    // Optional datalist suggestions
    const instruments = cfg.instruments || [];
    let datalist = document.getElementById("instrumentDatalist");
    if (!datalist) {
        datalist = document.createElement("datalist");
        datalist.id = "instrumentDatalist";
        document.body.appendChild(datalist);
    }
    datalist.innerHTML = "";
    instruments.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.id;
        datalist.appendChild(opt);
    });
    el.setAttribute("list", "instrumentDatalist");
}

function applyFieldRules(cfg) {
    const fields = cfg.fields || {};
    applyRequired(document.getElementById("broker"), fields.broker?.required === true);
    applyRequired(document.getElementById("strategy"), fields.strategy?.required === true);
    applyRequired(document.getElementById("instrument"), fields.instrument?.required === true);
}

function setInstrumentEnabled(enabled) {
    const group = document.getElementById("instrumentGroup");
    const instrumentEl = document.getElementById("instrument");
    if (!instrumentEl) return;

    if (enabled) {
        instrumentEl.disabled = false;
        instrumentEl.removeAttribute("data-disabled-by-strategy");
        instrumentEl.setAttribute("required", "required");
        if (group) group.style.display = "";
    } else {
        instrumentEl.disabled = true;
        instrumentEl.setAttribute("data-disabled-by-strategy", "1");
        instrumentEl.removeAttribute("required");
        instrumentEl.value = ""; // clear user selection
        if (group) group.style.display = "none"; // or keep visible but disabled
    }
}

/**
 * Finds strategy definition in JSON by id.
 */
function getStrategyDef(strategyId) {
    if (!UI_CFG || !UI_CFG.strategies) return null;
    return UI_CFG.strategies.find(s => s.id === strategyId) || null;
}

/**
 * Create a single input row for a param definition.
 * paramDef schema keys:
 *   key,label,type,required,default,min,max,step,placeholder,help
 */
function createParamField(paramDef) {
    const wrap = document.createElement("div");
    wrap.className = "form-group";
    wrap.style.marginTop = "10px";

    const label = document.createElement("label");
    label.setAttribute("for", `param_${paramDef.key}`);
    label.textContent = paramDef.label || paramDef.key;

    const input = document.createElement("input");
    input.className = "form-control";
    input.id = `param_${paramDef.key}`;
    input.name = `param_${paramDef.key}`;
    input.dataset.paramKey = paramDef.key;

    // Type handling
    const t = (paramDef.type || "text").toLowerCase();
    input.type = (t === "number" || t === "text") ? t : "text";

    if (paramDef.placeholder) input.placeholder = String(paramDef.placeholder);

    // Required
    if (paramDef.required === true) {
        input.setAttribute("required", "required");
    }

    // Numeric constraints
    if (input.type === "number") {
        if (paramDef.min !== undefined) input.min = String(paramDef.min);
        if (paramDef.max !== undefined) input.max = String(paramDef.max);
        if (paramDef.step !== undefined) input.step = String(paramDef.step);
    }

    // Default value
    if (paramDef.default !== undefined && paramDef.default !== null) {
        input.value = String(paramDef.default);
    }

    wrap.appendChild(label);
    wrap.appendChild(input);

    // Optional help text
    if (paramDef.help) {
        const small = document.createElement("small");
        small.style.display = "block";
        small.style.marginTop = "4px";
        small.style.opacity = "0.8";
        small.textContent = String(paramDef.help);
        wrap.appendChild(small);
    }

    return wrap;
}

/**
 * Render strategy params section based on selected strategy id.
 */
function renderStrategyParams(strategyId) {
    const container = document.getElementById("strategyParams");
    if (!container) return;

    container.innerHTML = ""; // clear previous

    const def = getStrategyDef(strategyId);
    if (!def) return;

    const params = def.params || [];
    if (params.length === 0) return;

    // Optional section title
    const title = document.createElement("div");
    title.style.marginTop = "10px";
    title.style.fontWeight = "600";
    title.textContent = "Strategy Parameters";
    container.appendChild(title);

    params.forEach(p => {
        container.appendChild(createParamField(p));
    });
}

function applyStrategyRules(strategyId) {
    const def = getStrategyDef(strategyId);
    if (!def) return;

    // Default behavior: require instrument unless explicitly false
    const requiresInstrument = def.requires_instrument !== false;

    setInstrumentEnabled(requiresInstrument);

    // Optional: if strategy does not require instrument, set default
    if (!requiresInstrument && def.default_instrument_id) {
        // You can either store it for payload, OR still set it silently.
        // If you want payload to include it, we can store it in a global variable.
        window.__strategyDefaultInstrumentId = def.default_instrument_id;
    } else {
        window.__strategyDefaultInstrumentId = null;
    }
}

/**
 * Read current strategy params from the dynamic form fields.
 * Returns: { ema_fast: 9, ema_slow: 21, ... }
 */
function readStrategyParamsFromUI() {
    const container = document.getElementById("strategyParams");
    if (!container) return {};

    const inputs = container.querySelectorAll("input[data-param-key]");
    const out = {};

    inputs.forEach(inp => {
        const key = inp.dataset.paramKey;
        let val = inp.value;

        // Convert numeric types
        if (inp.type === "number") {
            if (val === "" || val === null || val === undefined) return;
            val = Number(val);
        }

        out[key] = val;
    });

    return out;
}

async function loadUiOptions() {
    const res = await fetch(UI_OPTIONS_PATH, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ui-options.json (HTTP ${res.status})`);
    UI_CFG = await res.json();

    fillSelect("broker", UI_CFG.brokers || []);
    fillSelect("strategy", UI_CFG.strategies || []);
    fillSelect("instrument", UI_CFG.instruments || []);
    fillInstrumentField(UI_CFG);
    applyFieldRules(UI_CFG);

    // Render params for default strategy (if any)
    const strategyEl = document.getElementById("strategy");
    if (strategyEl && strategyEl.value) {
        renderStrategyParams(strategyEl.value);
        applyStrategyRules(strategyEl.value);
    }

    // On strategy change: rebuild params UI
    if (strategyEl) {
        strategyEl.addEventListener("change", () => {
            renderStrategyParams(strategyEl.value);
            applyStrategyRules(strategyEl.value);
        });
    }

    return UI_CFG;
}

// Call on page load
document.addEventListener("DOMContentLoaded", () => {
    loadUiOptions().catch(err => console.error(err));
});

// ============================================================================
// IMPORTANT: integrate strategy params into your runBacktest() payload
// ============================================================================

// Wherever you build payload for backend, do:
// params: readStrategyParamsFromUI()
//
// Example snippet (use inside your existing runBacktest()):
//
// const payload = {
//   broker: document.getElementById("broker").value,
//   instrument_id: document.getElementById("instrument").value,
//   timeframe: document.getElementById("timeframe").value,
//   start_ist: document.getElementById("start_ist").value,
//   end_ist: document.getElementById("end_ist").value,
//   strategy: document.getElementById("strategy").value,
//   capital: Number(document.getElementById("capital").value || 100000),
//   qty: Number(document.getElementById("qty").value || 1),
//   feature_pack: document.getElementById("feature_pack")?.value || "default",
//   params: readStrategyParamsFromUI()
// };
