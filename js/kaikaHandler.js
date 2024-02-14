/*
Target to Change data
For N Rate
kaika
digital_stock set to 1 (same is init.)
print_count set to 2 (Init Number is 1)

chokaika
digital_stock set to 11 (Stars)
print_count set to 3 (Init Number is 1)

For Non N Rate

kaika
digital_stock set to 4 (Stars)
print_count set to 4 (Init Number is 1)

chokaika
digital_stock set to 5 (Stars)
print_count set to 5 (Init Number is 1)
*/

/**
 * Set max level after evolution.
 * @param {boolean} isNormal Is the card rate normal? 
 * @param {boolean} isSecondEvolution Has the card already undergone the first evolution (kaika)?
 * @returns {number} Max level after the evolution.
 */
function setMaxLevelAfterEvo(isNormal, isSecondEvolution) {
    let baseLevel = 10;
    let additionalLevel;
    if (!isSecondEvolution) {
        additionalLevel = isNormal ? 40 : 55;
    } else {
        additionalLevel = isNormal ? 90 : 60;
    }
    let maxLevel = baseLevel + additionalLevel;
    return maxLevel;
}
/**
 * If the choKaika evolution is attempted before the kaika evolution.
 * @extends Error
 */
class RequireKaika extends Error {
    constructor(msg) {
        const DefaultMsg = "This card Requires Take Kaika.";
        super(msg ?? DefaultMsg);
        this.name = this.constructor.name;
    }
}
/**
 * If the choKaika evolution is attempted when it has already been done.
 * @extends Error
 */
class ChoKaikaAlready extends Error {
    constructor(msg) {
        const DefaultMsg = "This card is already takes Cho-Kaika.";
        super(msg ?? DefaultMsg);
        this.name = this.constructor.name;
    }
}
/**
 * If the Kaika evolution is attempted when it has already been done.
 * @extends Error
 */
class KaikaAlready extends Error {
    constructor(msg) {
        const DefaultMsg = "This card is already takes Kaika.";
        super(msg ?? DefaultMsg);
        this.name = this.constructor.name;
    }
}

/**
 * If the rate string not belong to any of n,r,sr,srp,ssr.
 * @extends Error
 */
class OutOfRateGroup extends Error {
    constructor(msg) {
        const DefaultMsg = "Rate is not belong to any of n,r,sr,srp,ssr.";
        super(msg ?? DefaultMsg);
        this.name = this.constructor.name;
    }
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
const emptyDayTimeStr = '0000-00-00 00:00:00.0';
/**
 * Ongeki Card evolution function.
 * @author jomin398
 * @param {string} rate Card Rate. 'n' stands for normal rate.
 * @param {Object} obj Object that contains card information.
 * @param {string} evolutionType Type of evolution. Either 'kaika' or 'choKaika'.
 * @throws {RequireKaika} 
 * @throws {ChoKaikaAlready}
 * @throws {KaikaAlready}
 * @throws {OutOfRateGroup}
 * @returns {Object} Updated object after evolution.
 */
function evolve(rate, obj, isChoKaika = false) {
    if (!rate || typeof rate != 'string') return;
    rate = rate.toLowerCase();
    const Rates = ['n', 'r', 'sr', 'srp', 'ssr'];
    if (!Rates.includes(rate)) throw new OutOfRateGroup();
    const isNormal = rate == 'n';
    const kaikaType = isChoKaika ? 'cho_kaika' : 'kaika';
    const dateField = `${kaikaType}_date`;

    if (obj[dateField] != emptyDayTimeStr) {
        if (isChoKaika) {
            throw new ChoKaikaAlready();
        } else {
            throw new KaikaAlready();
        }
    }

    if (isChoKaika && obj.kaika_date == emptyDayTimeStr) {
        throw new RequireKaika();
    }

    obj[dateField] = getCurrentTimeStr();
    obj.max_level = setMaxLevelAfterEvo(isNormal, isChoKaika);

    if (isChoKaika) {
        obj.print_count = isNormal ? 3 : 5;
        obj.digital_stock = isNormal ? 11 : 5;
    } else {
        obj.print_count = isNormal ? 2 : 4;
        obj.digital_stock = isNormal ? 1 : 4;
    }

    return obj;
}
/**
 * setBtns는 버튼 동작을 설정하는 클래스입니다.
 * @class
 * @param {Object} obj 카드 데이터
 * @param {number} rate 카드 등급 
 * @param {Object} opt 설정들
 * @param {HTMLElement} opt.kaikaBtn "kaika" 버튼 
 * @param {HTMLElement} opt.choKaikaBtn "choKaika" 버튼
 * @param {CallableFunction} opt.onUpdate 버튼을 클릭하면 호출되는 업데이트 함수.
 * @param {CallableFunction} opt.onError 에러가 나면 호출되는 함수.
 */
class setBtns {
    constructor(obj, rate, opt) {
        let { kaikaBtn, choKaikaBtn, onUpdate, onError } = opt;
        if (!onUpdate) onUpdate = console.log;
        if (!onError) onError = e => { throw e; };
        Object.assign(this, { kaikaBtn, choKaikaBtn, onUpdate, onError, data: obj, rate })
        this.kaikaBtn.onclick = () => {
            try {
                this.data = evolve(this.rate, this.data, false);
                this.onUpdate(this.data)
            } catch (error) {
                onError(error);
            }
        };
        this.choKaikaBtn.onclick = () => {
            try {
                this.data = evolve(this.rate, this.data, true);
                this.onUpdate(this.data)
            } catch (error) {
                onError(error);
            }
        };
    }
}

function genUpdateCardSQLiteCMD(tableName, data) {
    let command = `UPDATE ${tableName}\nSET\n`;

    // 데이터의 각 키와 값을 반복하여 명령어를 생성합니다.
    Object.keys(data).forEach((key, index, array) => {
        // 문자열 데이터의 경우 따옴표를 추가해야 합니다.
        let value = typeof data[key] === 'string' ? `'${data[key]}'` : data[key];
        command += `    ${key} = ${value}`;

        // 마지막 항목이 아니면 콤마를 추가합니다.
        if (index !== array.length - 1) {
            command += ',\n';
        } else {
            command += '\n';
        }
    });

    command += `WHERE id = ${data.id};`;
    return command;
}
