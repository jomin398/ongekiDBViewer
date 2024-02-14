let openedChrList = false;
function cardSearch() {
    const InputElm = $("#query-input");
    const queryOp = $("#queryopt").val();
    const text = InputElm.val();
    const detectNAN = /^[0-9]*$/g.test(text);

    searched = false;
    if (text == '') {
        InputElm.focus();
        showAlert(translateData.EmptySearchQuery, true);
        return;
    } else if (queryOp == 'by_uuid' && !detectNAN) {
        showAlert(translateData.UUIDSyntaxError, true);
        return;
    }
    //$(".advencedControl");
    //editor = ace.edit("sql-editor");

    if (!openedChrList) {
        if (queryOp == "by_name") {
            editor.setValue(`SELECT * FROM 'ongeki_game_card' Where name Like "%${text}%"`, -1);
        } else if (queryOp == 'by_uuid') {
            editor.setValue(`SELECT * FROM 'ongeki_game_card' Where id Like "%${text}%"`, -1);
        }
    } else {
        console.log("prepare open char")
        if (queryOp == "by_name") {
            editor.setValue(`SELECT * FROM 'ongeki_game_chara' Where name Like "%${text}%"`, -1);
        }
        if (queryOp == 'by_uuid') {
            editor.setValue(`SELECT * FROM 'ongeki_game_chara' Where id Like "%${text}%"`, -1);
        }
    }

    searched = true;
    $("#sql-run").click();

    //console.log(text,!detectNAN,queryOp);
}
function renderCharList() {
    const InputElm = $("#query-input");
    InputElm.attr("placeholder", "추가하려는 케릭터의 이름을 입력");
    console.log("renderCharList");
    const qur = "SELECT * FROM 'ongeki_user_character'";
    renderQuery(qur);
    openedChrList = true;
}
function mkCard(name, noRankedName, lv, maxLv, rarity, moreInfo, cardVersion, isKai, isChoKai, attribute, uuid, listNo) {
    return `<div class="cardWrap" id="${listNo}">
    <header>
      <div class="header-top">
        <span class="attr ${attribute}"></span>
        <span class="rank ${rarity}" translate="no">${rarity == "srp" ? "SR+" : rarity.toUpperCase()}</span>
      </div>
      ${(isKai || isChoKai) ? `<div class="evolution ${isChoKai ? "chokaika" : ""}">
      <img loading="lazy">
      <div class="labelWrap">
        <span class="text">${isChoKai ? "초개화" : "개화"}</span>
        <span class="ribbonWrap">
          <span class="ribbon"></span>
        </span>
      </div>
    </div>`: ""}
      
    </header>
    <span class="chrName" translate="no">${noRankedName}</span>
    <div class="cont-mid">
      <div class="levelCont">
        <span class="curLv">${lv}</span>
        <span>/</span>
        <span class="maxLv">${maxLv}</span>
      </div>
      <div class="cont-flex-row">
        <div class="cont-infos">
          <span class="info_name" translate="no">${name}</span>
          <span>${moreInfo}</span>
        </div>
        <span class="fakeQR" title="가짜 QR"></span>
      </div>
    </div>
    <footer>
      <span class="uuid" title="카드 고유 번호">${uuid}</span>
      <span class="version" title="카드 버전" translate="no">${cardVersion}</span>
    </footer>
  </div>`
}
function getUserData() {
    let d = null;
    const qurryResult = db.prepare(`SELECT * FROM ongeki_user_data`);
    if (qurryResult.step()) {
        d = qurryResult.getAsObject();
    }
    return d;
}
function getLTSUserPlayData() {
    let d = null;
    const idx = getTableRowsCount('ongeki_user_playlog');
    const qurryResult = db.prepare(`SELECT * FROM ongeki_user_playlog WHERE id = '${idx}'`);
    if (qurryResult.step()) {
        d = qurryResult.getAsObject();
    }
    return d;
}
function openCardOpt(e, uuid, listNum, rarity) {
    const emptyDayTimeStr = '0000-00-00 00:00:00.0';
    const createdDateTable = $("#CardOptionModel tbody tr:nth-child(1) > td");
    const skilIDTable = $("#CardOptionModel tbody tr:nth-child(2) > td");
    const kaikaDateTable = $("#CardOptionModel tbody tr:nth-child(3) > td");
    const choKaikaDateTable = $("#CardOptionModel tbody tr:nth-child(4) > td");
    const kaikaBtn = $("#CardOptionModel .kaika");
    const choKaikaBtn = $("#CardOptionModel .chokaika")
    let cardQuery = `SELECT * FROM ongeki_user_card WHERE card_id =${uuid} And id=${listNum}`;
    let cardStmt = db.prepare(cardQuery);

    //init
    kaikaBtn.prop('disabled', false);
    choKaikaBtn.prop('disabled', false);
    createdDateTable.text(emptyDayTimeStr);
    kaikaDateTable.text(emptyDayTimeStr);
    choKaikaDateTable.text(emptyDayTimeStr);
    skilIDTable.text(-1);
    function onUpdate(data) {
        //console.log("cardUpdated",data) // listNum
        editor.setValue(genUpdateCardSQLiteCMD('ongeki_user_card', data));
        try {
            executeSql();
            $('#CardOptionModel').modal('hide');
            userCardList();

            const isChoKai = data.cho_kaika_date != emptyDayTimeStr;
            const text = isChoKai ? "초개화" : "개화";
            showAlert(`성공적으로 카드가 ${text}되엇습니다.`)
        } catch (error) {
            if (error.message.includes("UNIQUE constraint failed")) {
                showAlert("이전과 동일한 카드데이터 입니다.", true)
            } else {
                throw error;
            }
        }
    }
    function onError(error) {
        if (error instanceof RequireKaika) {
            showAlert("우선 개화를 진행해주세요", true);
        } else if (error instanceof KaikaAlready) {
            showAlert("이미 개화를 했습니다", true);
        } else if (error instanceof ChoKaikaAlready) {
            showAlert("이미 초개화를 했습니다", true);
        } else
            console.error(error);
    }
    const Settings = { kaikaBtn: kaikaBtn[0], choKaikaBtn: choKaikaBtn[0], onUpdate, onError };

    //parse data from db.
    if (!cardStmt.step()) { cardStmt.free(); return; } else {
        const cr = cardStmt.getAsObject();
        const isChoKai = cr.cho_kaika_date != emptyDayTimeStr;
        const isKai = cr.kaika_date != emptyDayTimeStr;
        const createdDate = cr.created;
        const skilID = cr.skill_id;
        //console.log(cr)
        createdDateTable.text(createdDate);
        skilIDTable.text(skilID);
        if (isKai) {
            kaikaBtn.prop('disabled', true);//[0].disabled = true;
            kaikaDateTable.text(cr.kaika_date);
        }
        if (isChoKai) {
            choKaikaBtn.prop('disabled', true);//[0].disabled = true;
            choKaikaDateTable.text(cr.cho_kaika_date);
        }
        new setBtns(cr, rarity, Settings)
        $('#CardOptionModel').modal('show');
    }
    cardStmt.free();
}
function userCardList() {
    const qur = "SELECT * FROM 'ongeki_user_card'";
    const targetTableName = "ongeki_user_card";
    const emptyDayTimeStr = '0000-00-00 00:00:00.0';
    const dispElm = $(".userCardWrap");
    dispElm.html("");
    let columnTypes = new Map();
    if (targetTableName != null) {
        columnTypes = getTableColumnTypes(targetTableName);
    }
    function addZeroToNumber(numString, length) {
        numString = numString.slice(0, -1);
        const zerosToAdd = length - numString.length;
        const zeros = "0".repeat(zerosToAdd);
        return numString + zeros;
    }

    function generateID(id) {
        const idLength = id.toString().length;
        const zerosToAdd = Math.max(0, 6 - idLength);
        const zeros = "0".repeat(zerosToAdd);
        return zeros + id;
    }
    let sel = null;
    try {
        sel = db.prepare(qur);
    } catch (ex) {
        if (sel != null) {
            sel.free();
        }
        ShowDataQurError(ex);
        return;
    }
    const rowCount = getTableRowsCount(targetTableName);
    openedChrList = false;
    let LtsUsedCards = (d => {
        console.log(d);
        let { card_id1, card_id2, card_id3 } = d;
        return [card_id1, card_id2, card_id3]
    })(getLTSUserPlayData())
    console.log(`now rendering... ${rowCount} chars...`);
    let percIdx = 0;
    while (sel.step()) {
        const s = sel.get();
        //console.log(s) // [listNo,stock, id,....]

        let id = s[2]; // s[2] is the id from your 's' array
        let cardQuery = `SELECT * FROM ongeki_game_card WHERE id = '${id}'`;
        let cardStmt = db.prepare(cardQuery);
        let isChoKai = false;
        let isKai = false;
        isChoKai = s[3] != emptyDayTimeStr;
        isKai = s[9] != emptyDayTimeStr;

        if (cardStmt.step()) {
            const cardResult = cardStmt.getAsObject();
            const paddedDateNumber = addZeroToNumber(s[4].replace(/[-:. ]/g, ""), 14);
            const paddedID = generateID(s[2]);
            const uuid = paddedDateNumber + "" + paddedID;
            let name = cardResult.name.replace(/\【.*\】/gm, '').trim();
            let noRankedName = name.replace(/\[.*\]/gm, '').trim();
            let moreInfo = cardResult.nick_name != "None" ? cardResult.nick_name : "";
            let rarity = cardResult.rarity.toLowerCase().replace("srplus", "srp");
            const attr = cardResult.attribute.toLowerCase();
            const genaratedCardElm = mkCard(name, noRankedName, s[10], s[11], rarity, moreInfo, cardResult.card_number, isKai, isChoKai, attr, uuid, s[0]);
            dispElm.append(genaratedCardElm);
            $(`.cardWrap#${s[0]}`).click(e => openCardOpt(e, s[2], s[0], rarity));

        }
        cardStmt.free();
        percIdx++;
        let perc = ((percIdx / rowCount) * 100).toFixed(1);
        console.log(`rendering... ${perc}%`);
    }

    sel.free();
    $("#CardListModal").modal('show');
}
function getCurrentTimeStr() {
    let date = new Date();

    let formattedDate = date.getFullYear() + '-' +
        ('0' + (date.getMonth() + 1)).slice(-2) + '-' +
        ('0' + date.getDate()).slice(-2) + ' ' +
        ('0' + date.getHours()).slice(-2) + ':' +
        ('0' + date.getMinutes()).slice(-2) + ':' +
        ('0' + date.getSeconds()).slice(-2) + '.' +
        Math.floor(date.getMilliseconds() / 100);
    return formattedDate;
}
function selectChar(elm) {
    elm = elm.parentElement.parentElement;
    const emptyDayTimeStr = '0000-00-00 00:00:00.0';
    const targetTableName = 'ongeki_user_card';
    let currentTarget = targetTableName;
    let rowCount = getTableRowsCount(currentTarget);
    const cardColumHeads = ['id', 'analog_stock', 'card_id', 'cho_kaika_date', 'created', 'digital_stock', 'exp', 'is_acquired', 'is_new', 'kaika_date', 'level', 'max_level', 'print_count', 'skill_id', 'use_count', 'user_id']
    const nemesisColumHeads = ['id', 'character_id', 'costume_id', 'attachment_id', 'intimate_count', 'intimate_count_date', 'intimate_count_rewarded', 'intimate_level', 'is_new', 'play_count', 'user_id'];
    //id	name	cv	model_id
    function parseSelectedNemesis(obj, span, index) {
        switch (index) {
            case 0:
                obj.nemesisId = span.title;
                break;
            case 1:
                obj.name = span.title;
                break;
            case 2:
                obj.cv = span.title;
                break;
            case 3:
                obj.model_id = span.title;
                break;
        }
        return obj;
    }

    function parseSelectedCard(obj, span, index) {
        switch (index) {
            case 0:
                obj.uuid = span.title;
                break;
            case 1:
                obj.name = span.title;
                break;
            case 2:
                obj.nickName = span.title;
                break;
            case 3:
                obj.color = span.title;
                break;
            case 4:
                obj.nemesisId = span.title;
                break;
            case 5:
                obj.school = span.title;
                break;
            case 6:
                obj.gakunen = span.title;
                break;
            case 7:
                obj.rates = span.title;
                break;
            case 8:
                obj.lvExpParam = span.title;
                break;
            case 9:
                obj.skillId = span.title;
                break;
            case 10:
                obj.chokaikaSkillId = span.title;
                break;
            case 11:
                obj.cardNumber = span.title;
                break;
            case 12:
                obj.version = span.title;
                break;
        }
        return obj;
    }
    let data = null
    if (!openedChrList) {
        //add card
        data = Array.from(elm.querySelectorAll('span')).reduce(parseSelectedCard, {});
        sqCmd = `INSERT INTO ${currentTarget}
 (${cardColumHeads.join(',')}) 
 VALUES (${rowCount + 1}, 0, ${data.uuid}, "${emptyDayTimeStr}","${getCurrentTimeStr()}",1,0,1,1,"${emptyDayTimeStr}",1,10,1,${data.skillId},0,1)`;
        searched = false;
        editor.setValue(sqCmd);
        try {
            executeSql();
        } catch (error) {
            if (error.message.includes("UNIQUE constraint failed")) {
                showAlert("이미 카드가 존제합니다.", true);
            } else {
                throw error;
            }
        }
        dbReset();
        doDefaultSelect(targetTableName);
    } else {
        data = Array.from(elm.querySelectorAll('span')).reduce(parseSelectedNemesis, {});

        //add nemesis
        currentTarget = 'ongeki_user_character';
        rowCount = getTableRowsCount(currentTarget);
        sqCmd = `INSERT INTO ${currentTarget}
     (${nemesisColumHeads.join(',')}) 
    VALUES (${rowCount + 1}, ${data.nemesisId}, 0, 0, 0,"${getCurrentTimeStr()}",0,0,1,0,1)`;
        searched = false;
        editor.setValue(sqCmd);
        try {
            executeSql();
        } catch (error) {
            if (error.message.includes("UNIQUE constraint failed")) {
                showAlert("이미 케릭터가 존제합니다.", true)
            } else {
                throw error;
            }
        }
        dbReset();
        openedChrList = !openedChrList;
        doDefaultSelect(currentTarget);
    }
}

const genUserLogin = () => new Promise((res, rej) => {
    const loginModal = $("#userLogin");
    const inputElm = $("#accessCodeInput");
    const userData = getUserData();
    const userName = [userData.user_name].map(toHalfWidth)[0];
    function guidUpt(v = 0) {
        $(".accessCode_guide.status").text(`${v}/24`);
        if (v == 24) {
            inputElm.removeClass("is-invalid").addClass("is-valid")
        } else {
            inputElm.removeClass("is-valid").addClass("is-invalid")
        }
    }
    //autoSplit numbers by 4 digits
    function numFormater(ev) {
        ev.target.value = ev.target.value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
        let v = ev.target.value.length;
        guidUpt(v);
    }

    loginModal.on('hidden.bs.modal', e => {
        if (!isUserLoggedIn)
            loginModal.modal('show');
    })
    inputElm.prop('required', true);
    inputElm.on("input", numFormater);
    loginModal.modal('show');

    let sel = db.prepare(`SELECT * FROM 'sega_card' where id=1`);
    let hasData = sel.step();
    if (!hasData) sel.free();
    let { luid } = sel.getAsObject();
    const accessCode = luid.replace(/(.{4})/g, '$1 ').trim();
    $("#userLogin #userID").val(userName)

    $("#userLogin #userLV").val(userData.level)


    $("#userLogin #LTSVersion").val(userData.last_rom_version)
    console.log(getLTSUserPlayData(), userName, userData, accessCode)
    loginModal.submit(function (ev) {
        const inputValue = inputElm.val();

        if (inputValue !== accessCode) {
            ev.preventDefault();
            // 에러 메시지 표시

            if (inputValue.length != 24) {
                inputElm.focus();
            } else {
                alert("기존 접근 번호와 달라요.");
                inputElm.val("");
                guidUpt(0);
            }
        } else {
            ev.preventDefault();
            isUserLoggedIn = true;
            loginModal.modal('hide');
            $(".ac_box .ac").text(accessCode);
            res(true);
        }
    });
});