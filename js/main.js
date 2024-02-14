"use strict";

const SQL_WASM_PATH = "./js/sql-wasm.wasm";

const SQL_FROM_REGEX = /FROM\s+((?=['"])((["'])(?<g1>[^'"]+))|(?<g2>\w+))/mi;
const SQL_LIMIT_REGEX = /LIMIT\s+(\d+)(?:\s*,\s*(\d+))?/mi;
const SQL_SELECT_REGEX = /SELECT\s+[^;]+\s+FROM\s+/mi;

let db = null;
let lastCachedQueryCount = {
    select: "",
    count: 0
};
let loadedTableNames = [];
let editor;
const errorBox = $("#error");
const infoBox = $("#info");
const queryElm = $("#query-box");
let searched = false;

let SQLModule = null;
let isFirstRun = false;
let isUserLoggedIn = false;
const selectFormatter = function (item) {
    const index = item.text.indexOf("(");
    if (index > -1) {
        const name = item.text.substring(0, index);
        const tableName = item.text.substring(index - 1);
        return $(`<span>${name}<span style="color:#ccc">${tableName}</span></span>`);
    } else {
        return item.text;
    }
};

window.onload = () => {
    initialize();
    InitializeEditor();
}

function InitializeEditor() {
    queryElm.hide();
    //Initialize editor
    editor.setTheme("ace/theme/chrome");
    editor.renderer.setShowGutter(false);
    editor.renderer.setShowPrintMargin(false);
    editor.renderer.setPadding(20);
    editor.renderer.setScrollMargin(8, 8, 0, 0);
    editor.setHighlightActiveLine(false);
    editor.getSession().setUseWrapMode(true);
    editor.getSession().setMode("ace/mode/sql");
    editor.setOptions({
        maxLines: 5
    });
    editor.setFontSize(16);

    $(".no-propagate").on("click", function (el) {
        el.stopPropagation();
    });

    //Check url to load remote DB
    $.urlParam = function (name) {
        let results = new RegExp(`[\?&]${name}=([^&#]*)`).exec(window.location.href);
        if (results == null) {
            return null;
        } else {
            return results[1] || 0;
        }
    };
    const loadUrlDB = $.urlParam("url");
    if (loadUrlDB != null) {
        setIsLoading(true);
        const xhr = new XMLHttpRequest();
        xhr.open("GET", decodeURIComponent(loadUrlDB), true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function (e) {
            loadDB(this.response);
        };
        xhr.onerror = function (e) {
            setIsLoading(false);
        };
        xhr.send();
    }
}

function initialize() {
    editor = ace.edit("sql-editor");
    $(".reuploadinfo").hide();

    $('#CardOptionModel').on('hidden.bs.modal', e => {
        jQuery.removeData(e.currentTarget)
    })

    let fileReaderOpts = {
        readAsDefault: "ArrayBuffer",
        on: {
            load: function (e) {
                loadDB(e.target.result);
            }
        }
    };

    let toggleFullScreen = function () {
        const container = $("#main-container");
        const resizerExpandIcon = $("#resizer-expand");
        const resizerCollapseIcon = $("#resizer-collapse");

        container.toggleClass("container container-fluid");
        resizerExpandIcon.toggle();
        resizerCollapseIcon.toggle();
    };
    $("#resizer").click(toggleFullScreen);
    $("#sql-editor").keydown(onKeyDown);

    if (typeof FileReader === "undefined" || typeof WebAssembly === "undefined") {
        $("#dropzone, #dropzone-dialog").hide();
        $("#compat-error").toggleClass("d-none", false);
    } else {
        $("#dropzone, #dropzone-dialog").fileReaderJS(fileReaderOpts);
    }
}

function tableInit(tablesData) {

    let firstTableName = null;

    const tableList = $("#tables");
    while (tablesData.step()) {
        const rowObj = tablesData.getAsObject();
        const name = rowObj["name"];
        const type = rowObj["type"];

        if (firstTableName === null) {
            firstTableName = name;
        }
        const rowCount = getTableRowsCount(name);
        loadedTableNames.push(name);
        const tableType = type !== "table" ? `, ${type}` : "";
        tableList.append(`<option value="${name}">${name} (${rowCount} rows${tableType})</option>`);
    }
    tablesData.free();
    //Select first table and show It
    tableList.val(firstTableName);
    doDefaultSelect(firstTableName);
    $("#output-box").fadeIn();
    $(".nouploadinfo").hide();
    $(".reuploadinfo").show();
    $("#sample-db-link").hide();
    $("#dropzone").delay(50).animate({
        height: 75
    }, 500);


    $("#success-box").show();

    //extras
    $("#openConfig").show();
    $("#query-box").show();
    $(".advencedControl").hide();
    $(".qurredResult").hide();
    $("#menu-box").show();
    setIsLoading(false);
}

function dbReset(arrayBuffer) {
    setIsLoading(true);
    resetTableList();
    let tables = null;
    try {
        isFirstRun = !db ? true : false;
        db ??= new SQLModule.Database(new Uint8Array(arrayBuffer));

        //Get all table names from master table
        tables = db.prepare("SELECT * FROM sqlite_master WHERE type='table' OR type='view' ORDER BY name");
    } catch (ex) {
        if (tables !== null) {
            tables.free();
        }
        setIsLoading(false);
        console.error(ex);
        window.alert(ex);
        return;
    }

    if (isFirstRun && !isUserLoggedIn) {
        genUserLogin()
            .then(() => tableInit(tables))
            .catch(error => {
                throw error;
            });
    } else if (isUserLoggedIn) {
        tableInit(tables);
    }
}

function loadDB(arrayBuffer) {
    initSqlJs({
        locateFile: file => SQL_WASM_PATH
    })
        .then(
            SQL => {
                SQLModule = SQL;
                dbReset(arrayBuffer);
            });
}

function getTableRowsCount(name) {
    const sel = db.prepare(`SELECT COUNT(*) AS count FROM '${name}'`);
    if (sel.step()) {
        const count = sel.getAsObject()["count"];
        sel.free();
        return count;
    } else {
        sel.free();
        return -1;
    }
}

function getQueryRowCount(query) {
    if (query === lastCachedQueryCount.select) {
        return lastCachedQueryCount.count;
    }

    let queryReplaced = query.replace(SQL_SELECT_REGEX, "SELECT COUNT(*) AS count FROM ");

    if (queryReplaced !== query) {
        queryReplaced = queryReplaced.replace(SQL_LIMIT_REGEX, "");
        const sel = db.prepare(queryReplaced);
        if (sel.step()) {
            const count = sel.getAsObject()["count"];
            sel.free();

            lastCachedQueryCount.select = query;
            lastCachedQueryCount.count = count;

            return count;
        } else {
            sel.free();
            return -1;
        }
    } else {
        return -1;
    }
}

function getTableColumnTypes(tableName) {
    let result = new Map();
    const sel = db.prepare(`PRAGMA table_info('${tableName}')`);

    while (sel.step()) {
        const obj = sel.getAsObject();
        let type = obj["type"];
        if (obj["notnull"] === 1) {
            type += " NOT NULL";
        }
        if (obj["pk"] === 1) {
            type += " PRIMARY KEY";
        }
        result.set(obj.name, type);
    }
    sel.free();

    return result;
}

function resetTableList() {
    const tables = $("#tables");
    loadedTableNames = [];
    tables.empty();
    tables.append("<option></option>");
    tables.select2({
        placeholder: "Select a table",
        theme: "bootstrap-5",
        templateSelection: selectFormatter,
        templateResult: selectFormatter
    });
    tables.on("change", function (e) {
        doDefaultSelect(tables.val());
    });
}

function setIsLoading(isLoading) {
    const dropText = $("#drop-text");
    const loading = $("#drop-loading");
    if (isLoading) {
        dropText.hide();
        loading.toggleClass("d-none", false);
    } else {
        dropText.show();
        loading.toggleClass("d-none", true);
    }
}

function dropzoneClick() {
    $("#dropzone-dialog").click();
}

function doDefaultSelect(name) {
    const defaultSelect = `SELECT * FROM '${name}' LIMIT 0,30`;
    editor.setValue(defaultSelect, -1);
    renderQuery(defaultSelect);
}

function executeSql() {
    const query = editor.getValue();
    renderQuery(query);
    $("#tables").val(getTableNameFromQuery(query));
}

function getTableNameFromQuery(query) {
    const sqlRegex = SQL_FROM_REGEX.exec(query);
    if (sqlRegex != null) {
        return sqlRegex.groups.g1 ?? sqlRegex.groups.g2;
    } else {
        return null;
    }
}

function parseLimitFromQuery(query) {
    const sqlRegex = SQL_LIMIT_REGEX.exec(query);
    if (sqlRegex != null) {
        let result = {
            max: 0,
            offset: 0
        };

        if (sqlRegex.length > 2 && typeof sqlRegex[2] !== "undefined") {
            result.offset = parseInt(sqlRegex[1]);
            result.max = parseInt(sqlRegex[2]);
        } else {
            result.offset = 0;
            result.max = parseInt(sqlRegex[1]);
        }

        if (result.max == 0) {
            result.pages = 0;
            result.currentPage = 0;
            return result;
        }

        const queryRowsCount = getQueryRowCount(query);
        if (queryRowsCount != -1) {
            result.pages = Math.ceil(queryRowsCount / result.max);
        }
        result.currentPage = Math.floor(result.offset / result.max) + 1;
        result.rowCount = queryRowsCount;

        return result;
    } else {
        return null;
    }
}

function setPage(el, next) {
    if ($(el).hasClass("disabled")) return;

    const query = editor.getValue();
    const limit = parseLimitFromQuery(query);

    let pageToSet = 0;
    if (typeof next !== "undefined") {
        pageToSet = (next ? limit.currentPage : limit.currentPage - 2);
    } else {
        const page = window.prompt("Go to page");
        if (!isNaN(page) && page >= 1 && page <= limit.pages) {
            pageToSet = page - 1;
        } else {
            return;
        }
    }

    const offset = (pageToSet * limit.max);
    editor.setValue(query.replace(SQL_LIMIT_REGEX, `LIMIT ${offset},${limit.max}`), -1);

    executeSql();
}

function refreshPagination(query) {
    const limit = parseLimitFromQuery(query);
    if (limit !== null && limit.pages > 0) {
        const pager = $("#pager");
        const pagePrev = $("#page-prev");
        const pageNext = $("#page-next");

        pager.attr("title", `Row count: ${limit.rowCount}`);
        bootstrap.Tooltip.getOrCreateInstance("#pager").hide();
        pager.text(limit.currentPage + " / " + limit.pages);

        if (limit.currentPage <= 1) {
            pagePrev.addClass("disabled");
        } else {
            pagePrev.removeClass("disabled");
        }

        if ((limit.currentPage + 1) > limit.pages) {
            pageNext.addClass("disabled");
        } else {
            pageNext.removeClass("disabled");
        }

        setPagerVisible(true);
    } else {
        setPagerVisible(false);
    }
}

function setPagerVisible(visible) {
    $("#bottom-bar").toggleClass("d-none", !visible);
    if (visible) {
        $("#footer").attr("style", "margin-top: -0.75rem !important");
    } else {
        $("#footer").css("margin-top", "");
    }
}

function htmlEncode(value) {
    return $("<div/>").text(value).html();
}

function renderSheet(query, tableName) {
    const dataBox = $("#data");
    const thead = dataBox.find("thead").find("tr");
    const tbody = dataBox.find("tbody");

    thead.empty();
    tbody.empty();
    errorBox.hide();
    infoBox.hide();
    dataBox.show();
    $(".qurredResult").show();
    let columnTypes = new Map();
    if (tableName != null) {
        columnTypes = getTableColumnTypes(tableName);
    }

    let sel = null;
    try {
        sel = db.prepare(query);
    } catch (ex) {
        if (sel != null) {
            sel.free();
        }
        ShowDataQurError(ex);
        return;
    }

    let isEmptyTable = true;
    const columnNames = sel.getColumnNames();
    for (let i = 0; i < columnNames.length; i++) {
        const type = columnTypes.get(columnNames[i]);
        thead.append(`<th><span data-bs-toggle="tooltip" title="${type}">${columnNames[i]}</span></th>`);
    }
    if (searched)
        thead.prepend(`<th>button</th>`);
    while (sel.step()) {
        isEmptyTable = false;
        const tr = $('<tr>');
        const s = sel.get();
        for (let i = 0; i < s.length; i++) {
            const type = columnTypes.get(columnNames[i]).toLowerCase();
            if (type === "blob" || type === "blob sub_type binary") {
                if (s[i] === null) {
                    tr.append(`<td><span title="Blob">null</span></td>`);
                } else {
                    renderBlobItem(tr, s[i]);
                }
            } else {
                let value = htmlEncode(s[i]);
                tr.append(`<td><span title="${value}">${value}</span></td>`);

            }

        }
        tbody.append(tr);
        if (searched) tr.prepend(`<td><button onclick="selectChar(this)">${translateData.Choice}</button></td>`);
    }
    sel.free();

    if (isEmptyTable) {
        infoBox.text(translateData.EmptyTable);
        infoBox.show();
    }

    refreshPagination(query);

    // Enable tooltips
    document.querySelectorAll('[data-bs-toggle="tooltip"]')
        .forEach(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

    dataBox.editableTableWidget();
}

function renderQuery(query) {
    const isEasyView = document.querySelector('.advencedControl').style.display == 'none';
    const tableName = getTableNameFromQuery(query);
    if (tableName && tableName.includes('ongeki_user_card') && isEasyView) {
        userCardList();
    } else {
        renderSheet(query, tableName)
    }
}

function renderBlobItem(tr, bytes) {
    const td = document.createElement("td");
    const span = document.createElement("span");
    span.title = "Blob";
    const downloadLink = document.createElement("a");
    downloadLink.href = "javascript:void(0)";
    downloadLink.innerText = `Download (${formatBytes(bytes.length)})`;
    downloadLink.onclick = function () {
        saveAs(new Blob([bytes]), "blob");
    };
    span.append(downloadLink);
    td.append(span);
    tr.append(td);
}

function formatBytes(bytes, decimals) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024,
        dm = decimals || 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        executeSql();
    }
}

function toggleAdvSearch() {
    if ($("#advSearchEnable").is(":checked")) $(".advencedControl").show();
    else $(".advencedControl").hide();
}