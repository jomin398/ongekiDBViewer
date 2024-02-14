function arrayToCsv(data) {
    return data.map(row =>
        row.map(String) // convert every value to String
            .map(v => v.replaceAll('"', '""')) // escape double quotes
            .map(v => `"${v}"`) // quote it
            .join(',') // comma-separated
    ).join('\r\n'); // rows starting on new lines
}

function exportAsDB() {
    saveAs(new Blob([db.export()], {
        type: "application/octet-stream"
    }), `edited (${getCurrentTimeStr()}).sqlite`);
}

function exportQueryTableToCsv() {
    setIsLoading(true);
    const editor = ace.edit("sql-editor");
    const query = editor.getValue();
    const exportedRows = exportCsvTableQuery(query);
    if (exportedRows != null) {
        const blob = new Blob([arrayToCsv(exportedRows)], {
            type: "text/plain;charset=utf-8"
        });
        saveAs(blob, "exported_" + getTableNameFromQuery(query).toLowerCase() + "_db.csv");
    }

    setIsLoading(false);
}

function exportCsvTable(tableName) {
    return exportCsvTableQuery(`SELECT * FROM '${tableName}'`);
}

function exportAllToCsv() {
    setIsLoading(true);
    const zip = new JSZip();
    for (const tableName of loadedTableNames) {
        const exportedRows = exportCsvTable(tableName);
        if (exportedRows != null) {
            zip.file(tableName + ".csv", arrayToCsv(exportedRows));
        } else {
            return;
        }
    }

    zip.generateAsync({
        type: "blob"
    })
        .then(function (content) {
            saveAs(content, "exported_all_db.zip");
        });
    setIsLoading(false);
}

function exportSelectedTableToCsv() {
    const tableName = $("#tables").val();
    setIsLoading(true);

    const exportedRows = exportCsvTable(tableName);
    if (exportedRows != null) {
        const blob = new Blob([arrayToCsv(exportedRows)], {
            type: "text/plain;charset=utf-8"
        });
        saveAs(blob, "exported_" + tableName.toLowerCase() + "_db.csv");
    }

    setIsLoading(false);
}
function exportCsvTableQuery(query) {
    let exportedRows = [];
    let sel = null;
    try {
        sel = db.prepare(query);
    } catch (ex) {
        if (sel != null) {
            sel.free();
        }
        ShowDataQurError(ex);
        setIsLoading(false);
        return null;
    }

    const columnNames = sel.getColumnNames();

    exportedRows.push(...[columnNames]);
    while (sel.step()) {
        const rows = sel.get();
        exportedRows.push(...[rows]);
    }
    sel.free();
    return exportedRows;
}
