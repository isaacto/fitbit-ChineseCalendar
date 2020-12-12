// -*- mode: javascript; js-indent-level: 2; -*-

// Date conversion code converted from JS and refactored from the code here:

// https://github.com/wolfhong/LunarCalendar/blob/master/lunarcalendar/converter.py

// Solar term is made to match that reported by HKO.

import document from "document";
import * as fs from "fs";
import * as messaging from "messaging";
import { preferences } from "user-settings";

const mainSect = document.getElementById("main");
const gregLabel = document.getElementById("gregLabel");
const lunarLabel = document.getElementById("lunarLabel");
const gregDateLabel = document.getElementById("gregDate");
const solarTermLabel = document.getElementById("solarTerm");
const lunarDateLabel = document.getElementById("lunarDate");
const todayButton = document.getElementById("todayButton");

const gregSetterSect = document.getElementById("gregSetter");
const gregYearTumbler = document.getElementById("gregYearTumbler");
const gregMonthTumbler = document.getElementById("gregMonthTumbler");
const gregDateTumbler = document.getElementById("gregDateTumbler");
const gregUseButton = document.getElementById("gregUseButton");
const gregCancelButton = document.getElementById("gregCancelButton");

const lunarSetterSect = document.getElementById("lunarSetter");
const lunarYearTumbler = document.getElementById("lunarYearTumbler");
const lunarMonthTumbler = document.getElementById("lunarMonthTumbler");
const lunarDateTumbler = document.getElementById("lunarDateTumbler");
const lunarLeapTumbler = document.getElementById("lunarLeapTumbler");
const lunarUseButton = document.getElementById("lunarUseButton");
const lunarCancelButton = document.getElementById("lunarCancelButton");

const UI_YEAR_START = 1970;

const WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

const STEMS = "甲乙丙丁戊己庚辛壬葵";  // 癸 not displayable in Versa
const BRANCHES = "子丑寅卯辰巳午未申酉戊亥"; // 戌 not displayable in Versa

const MONTHS = {
  "Digits": [
    "01-", "02-", "03-", "04-", "05-", "06-",
    "07-", "08-", "09-", "10-", "11-", "12-",
  ],
  "Chinese": [
    "正月", "二月", "三月", "四月", "五月", "六月",
    "七月", "八月", "九月", "十月", "十一月", "十二月",
  ],
}

const DAYS = {
  "Digits": [
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
  ],
  "Chinese": [
    "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
    "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
    "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
  ],
}

const LEAPS = {
  "Digits": ["-", "-*"],
  "Chinese": ["年", "年潤"],
}

const TERM_NAMES = {
  "Digits":  [
    "M.Cold", "S.Cold", "Sp.Commences", "Sp.Showers", "I.Waken", "V.Equinox",
    "B&Clear", "C.Rain", "Su.Commences", "C.Forms", "C.onEar", "S.Solstice",
    "M.Heat", "G.Heat", "A.Commences", "E.Heat", "W.Dew", "A.Equinox",
    "C.Dew", "Frost", "W.Commences", "L.Snow", "H.Snow", "W.Solstice"
  ],
  "Chinese": [
    "小寒", "大寒", "立春", "雨水", "驚蟄", "春分",
    "清明", "穀雨", "立夏", "小滿", "芒種", "夏至",
    "小暑", "大暑", "立秋", "處暑", "白露", "秋分",
    "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
  ]
}

let lunarChar = "Digits";

try {
  let saved = fs.readFileSync("settings.json", "json");
  lunarChar = saved[0];
  LEAPS[lunarChar][0];
} catch (err) {
  lunarChar = "Digits";
}

// Add a leading "0" to date part if needed
function to2(s) {
  s = "" + s;
  if (s.length < 2)
    return "0" + s;
  return s;
}

// Get bottom bits from data of a particular length after shifting
function getBits(data, length, shift) {
  return (data & (((1 << length) - 1) << shift)) >> shift;
}

// Turn the start of an adjusted year number to a day number defined
// to be the number of days since an imaginary "adjusted Gregorian
// date 0000-01-00".  The adjustment turns the leap day to the last
// day of the year, to simplify calculations.
function adjYear2Day(y) {
  return 365 * y + Math.floor(y / 4) - Math.floor(y / 100) +
    Math.floor(y / 400);
}

// Convert Gregorian date to a day number as defined in adjYear2Day
function greg2Int(gregDate) {
  let [y, m, d] = gregDate;
  m = (m + 9) % 12;
  y -= Math.floor(m / 10);
  return adjYear2Day(y) + Math.floor((m * 306 + 5) / 10) + (d - 1);
}

// Convert a day number as defined in adjYear2Day to the Gregorian date
function int2Greg(g) {
  let y = Math.floor((10000 * g + 14780) / 3652425);
  let ddd = g - adjYear2Day(y);
  if (ddd < 0) {
    --y;
    ddd = g - adjYear2Day(y);
  }
  let mi = Math.floor((100 * ddd + 52) / 3060)
  let mm = (mi + 2) % 12 + 1;
  y += Math.floor((mi + 2) / 12)
  return [y, mm, ddd - Math.floor((mi * 306 + 5) / 10) + 1]
}

// Start lunar year that we know how to convert
let START_YEAR = 1888;

// Each element describes a lunar year, starting with the one which
// starts during solar year START_YEAR.  Bit 0-12 describes whether
// each month in the year (including the leap month) has day 30, where
// bit 0 is month 1, bit 1 is month 2, and so on.  Bit 12 is unused
// if there is no leap month.  The leap month number is indicated in
// bit 13-16.
let LUNAR_MONTHS = [
  0x52d, 0xaad, 0x556a,  // 1888-1890
  0xdaa, 0xdda4, 0xea4, 0xd4a, 0xaa95, // 1891-1900
  0xa97, 0x556, 0x6ab5, 0xad5, 0x116d2,
  0x752, 0xea5, 0xb64a, 0x64b, 0xa9b, // 1901-1910
  0x9556, 0x56a, 0xb59, 0x5752, 0x752,
  0xdb25, 0xb25, 0xa4b, 0xb4ab, 0x2ad, // 1911-1920
  0x56b, 0x4b69, 0xda9, 0xfd92, 0xe92,
  0xd25, 0xba4d, 0xa56, 0x2b6, 0x95b5, // 1921-1930
  0x6d4, 0xea9, 0x5e92, 0xe92, 0xcd26,
  0x52b, 0xa57, 0xb2b6, 0xb5a, 0x6d4, // 1931-1940
  0x6ec9, 0x749, 0xf693, 0xa93, 0x52b,
  0xca5b, 0xaad, 0x56a, 0x9b55, 0xba4, // 1941-1950
  0xb49, 0x5a93, 0xa95, 0xf52d, 0x536,
  0xaad, 0xb5aa, 0x5b2, 0xda5, 0x7d4a, // 1951-1960
  0xd4a, 0x10a95, 0xa97, 0x556, 0xcab5,
  0xad5, 0x6d2, 0x8ea5, 0xea5, 0x64a, // 1961-1970
  0x6c97, 0xa9b, 0xf55a, 0x56a, 0xb69,
  0xb752, 0xb52, 0xb25, 0x964b, 0xa4b, // 1971-1980
  0x114ab, 0x2ad, 0x56d, 0xcb69, 0xda9,
  0xd92, 0x9d25, 0xd25, 0x15a4d, 0xa56, // 1981-1990
  0x2b6, 0xc5b5, 0x6d5, 0xea9, 0xbe92,
  0xe92, 0xd26, 0x6a56, 0xa57, 0x114d6, // 1991-2000
  0x35a, 0x6d5, 0xb6c9, 0x749, 0x693,
  0x952b, 0x52b, 0xa5b, 0x555a, 0x56a, // 2001-2010
  0xfb55, 0xba4, 0xb49, 0xba93, 0xa95,
  0x52d, 0x8aad, 0xab5, 0x135aa, 0x5d2, // 2011-2020
  0xda5, 0xdd4a, 0xd4a, 0xc95, 0x952e,
  0x556, 0xab5, 0x55b2, 0x6d2, 0xcea5, // 2021-2030
  0x725, 0x64b, 0xac97, 0xcab, 0x55a,
  0x6ad6, 0xb69, 0x17752, 0xb52, 0xb25, // 2031-2040
  0xda4b, 0xa4b, 0x4ab, 0xa55b, 0x5ad,
  0xb6a, 0x5b52, 0xd92, 0xfd25, 0xd25, // 2041-2050
  0xa55, 0xb4ad, 0x4b6, 0x5b5, 0x6daa,
  0xec9, 0x11e92, 0xe92, 0xd26, 0xca56, // 2051-2060
  0xa57, 0x4d6, 0x86d5, 0x755, 0x749,
  0x6e93, 0x693, 0xf52b, 0x52b, 0xa5b, // 2061-2070
  0xb55a, 0x56a, 0xb65, 0x974a, 0xb4a,
  0x11a95, 0xa95, 0x52d, 0xcaad, 0xab5, // 2071-2080
  0x5aa, 0x8ba5, 0xda5, 0xd4a, 0x7c95,
  0xc96, 0xf94e, 0x556, 0xab5, 0xb5b2, // 2081-2090
  0x6d2, 0xea5, 0x8e4a, 0x64b, 0x10c97,
  0x4ab, 0x55b, 0xcad6, 0xb6a, 0x752, // 2091-2100
  0x9725, 0xb25, 0xa8b, 0x549b, 0x4ab,
  0xe95b, 0x5ad, 0xbaa, 0xbb52, 0xd92, // 2101-2110
  0xd25, 0x9a4b, 0xa55, 0x134ad, 0x4b6,
  0x6b5
];

// Each element is the start date of a lunar year, starting with the
// one which starts during the solar year START_YEAR.  To reduce the
// code size a bit the start of lunar year in START_YEAR is subtracted
// from the days
let LUNAR_START = [
  0, 354, 709,  // 1888-1890
  1093, 1448, 1832, 2186, 2540,  // 1891-1900
  2923, 3278, 3632, 4016, 4371,
  4755, 5109, 5464, 5847, 6201, // 1901-1910
  6556, 6940, 7294, 7649, 8033,
  8387, 8771, 9125, 9479, 9863, // 1911-1920
  10217, 10572, 10956, 11311, 11695,
  12049, 12403, 12787, 13141, 13495, // 1921-1930
  13880, 14234, 14589, 14973, 15327,
  15710, 16064, 16419, 16803, 17158, // 1931-1940
  17512, 17896, 18250, 18634, 18988,
  19342, 19726, 20081, 20435, 20820, // 1941-1950
  21174, 21528, 21912, 22266, 22650,
  23004, 23359, 23743, 24097, 24452, // 1951-1960
  24836, 25190, 25573, 25928, 26282,
  26666, 27021, 27375, 27759, 28114, // 1961-1970
  28467, 28851, 29206, 29590, 29944,
  30299, 30683, 31037, 31391, 31775, // 1971-1980
  32129, 32513, 32867, 33222, 33606,
  33961, 34315, 34699, 35053, 35437, // 1981-1990
  35791, 36145, 36529, 36884, 37239,
  37623, 37977, 38331, 38714, 39069, // 1991-2000
  39453, 39807, 40162, 40546, 40900,
  41254, 41638, 41992, 42347, 42731, // 2001-2010
  43085, 43470, 43824, 44178, 44562,
  44916, 45270, 45654, 46009, 46393, // 2011-2020
  46747, 47102, 47486, 47840, 48194,
  48578, 48932, 49287, 49671, 50025, // 2021-2030
  50409, 50763, 51117, 51501, 51856,
  52210, 52594, 52949, 53333, 53687, // 2031-2040
  54041, 54425, 54779, 55133, 55517,
  55872, 56227, 56611, 56965, 57349, // 2041-2050
  57703, 58057, 58441, 58795, 59150,
  59534, 59889, 60273, 60627, 60981, // 2051-2060
  61364, 61719, 62073, 62457, 62812,
  63166, 63550, 63904, 64288, 64642, // 2061-2070
  64997, 65381, 65735, 66090, 66474,
  66828, 67212, 67566, 67920, 68304, // 2071-2080
  68659, 69013, 69397, 69752, 70106,
  70490, 70844, 71228, 71582, 71937, // 2081-2090
  72321, 72675, 73030, 73413, 73767,
  74151, 74505, 74860, 75244, 75599, // 2091-2100
  75953, 76337, 76691, 77045, 77429,
  77783, 78167, 78522, 78877, 79261, // 2011-2110
  79615, 79969, 80353, 80707, 81091,
  81445,
];

for (let i = 0; i < LUNAR_START.length; ++i)
  LUNAR_START[i] += 689560;


let MIN_TERM_YEAR = 1901;
let TERM_ERRS = {"1913-7":1, "1913-9":1, "1913-17":1, "1914-13":1, "1917-7":1, "1917-12":1, "1917-15":1, "1918-13":1, "1921-12":1, "1921-15":1, "1922-13":1, "1923-16":1, "1925-12":1, "1925-15":1, "1946-7":1, "1946-9":1, "1947-13":1, "1951-13":1, "1954-12":1, "1954-15":1, "1987-15":1, "2013-2":1, "2020-22":1, "2045-1":1, "2046-2":1, "2048-0":1, "2049-22":1, "2053-22":1, "2055-3":1, "2059-3":1, "2075-2":1, "2078-1":1, "2078-15":1, "2078-22":1, "2079-2":1, "2081-0":1, "2082-1":1, "2082-22":1, "2086-22":1, "2088-3":1, "2092-3":1, "2097-8":1};
let TERM_OFFSETS = [0.0, 14.920444788693807, 29.833051808420727, 44.758397906889044, 59.54743252787255, 74.5821308833559, 89.76342345646493, 104.92044142549231, 120.52424282149984, 135.9194333116249, 151.75938376057962, 167.0010066073415, 182.921456734612, 198.8332875519672, 214.5252410653325, 229.92145750707957, 245.75667628578304, 260.918429758073, 275.94699216997515, 291.38281326337346, 306.3828340872003, 320.959107085308, 335.92144770365934, 350.8342916501574];
let TERM_YEAR_OFFSETS = [6.16, 6.241, 6.5, 7.055, 6.16, 6.24, 6.5, 7.055, 6.16, 6.24, 6.5, 7.055, 6.079, 6.166, 6.44, 6.999, 6.078, 6.165, 6.44, 6.999, 6.078, 6.165, 6.241, 6.999, 6.078, 6.16, 6.241, 6.5, 6.054, 6.16, 6.241, 6.5, 6.054, 6.16, 6.24, 6.5, 6.054, 6.16, 6.24, 6.5, 6.054, 6.16, 6.24, 6.475, 6.0, 6.079, 6.166, 6.44, 5.999, 6.079, 6.166, 6.44, 5.999, 6.078, 6.16, 6.4, 5.999, 6.054, 6.16, 6.241, 5.5, 6.054, 6.16, 6.241, 5.5, 6.054, 6.16, 6.24, 5.5, 6.054, 6.16, 6.24, 5.475, 6.054, 6.081, 6.2, 5.47, 6.054, 6.08, 6.2, 5.47, 6.0, 6.079, 6.166, 5.45, 5.999, 6.078, 6.16, 5.242, 5.62, 6.054, 6.16, 5.241, 5.5, 6.054, 6.16, 5.24, 5.5, 6.054, 6.16, 5.24, 5.5, 6.054, 6.16, 5.24, 5.47, 6.054, 6.081, 5.2, 5.47, 6.043, 6.08, 5.166, 5.47, 6.0, 6.079, 5.166, 5.45, 5.62, 6.078, 5.1, 5.242, 5.62, 6.054, 5.1, 5.24, 5.5, 6.054, 5.1, 5.24, 5.5, 6.054, 5.1, 5.24, 5.47, 6.054, 5.1, 5.24, 5.47, 6.054, 5.08, 5.2, 5.47, 6.043, 5.079, 5.166, 5.47, 5.998, 5.078, 5.166, 5.242, 5.62, 5.078, 5.166, 5.24, 5.62, 5.06, 5.1, 5.24, 5.5, 5.06, 5.1, 5.24, 5.5, 5.06, 5.1, 5.24, 5.47, 5.06, 5.08, 5.24, 5.47, 5.041, 5.08, 5.166, 5.47, 5.041, 5.078, 5.166, 5.47, 4.998, 5.078, 5.166, 5.242, 4.63, 5.078, 5.166, 5.24, 4.63, 5.06, 5.1, 5.24, 4.6, 5.06, 5.1, 5.24, 4.47, 5.06, 5.1, 5.24];

// Convert Gregorian date to lunar date, as 4-tuple (y, m, d, l), where
// l is "on" only if the year has a leap month which is m
function greg2Lunar(gregDate) {
  let y = gregDate[0];
  let intDate = greg2Int(gregDate)
  let index = y - START_YEAR;
  let lstart = LUNAR_START[index];
  if (lstart > intDate) {
    lstart = LUNAR_START[--index];
    --y;
  }
  let offset = greg2Int(gregDate) - lstart + 1;
  let lmonth = LUNAR_MONTHS[index];
  let leap_month = getBits(lmonth, 4, 13) || 13;
  let ml = 1;
  for (let i = 0; i < 13; ++i) {
    let num_days = getBits(lmonth, 1, i) ? 30 : 29;
    if (offset <= num_days)
      break;
    ++ml;
    offset -= num_days;
  }
  let is_leap = false;
  if (ml > leap_month) {
    --ml;
    is_leap = ml == leap_month;
  }
  return [y, ml, offset, is_leap];
}

// Convert a lunar date to Gregorian date.  Leap flag is a preference,
// it has no effect if the specified month has no leap month.
function lunar2Greg(lunarDate) {
  let [yl, ml, dl, ll] = lunarDate;
  let index = yl - START_YEAR;
  let lmonth = LUNAR_MONTHS[index];
  let leap_month = getBits(lmonth, 4, 13) || 13;
  let offset = 0;
  let num_months = ml;
  if (num_months > leap_month || (num_months == leap_month && ll))
    ++num_months;
  --num_months;
  for (let i = 0; i < num_months; ++i)
    offset += getBits(lmonth, 1, i) ? 30 : 29;
  offset += dl;
  return int2Greg(greg2Int(int2Greg(LUNAR_START[index])) + offset - 1);
}

// Convert a Javascript Date to Gregorian date
function date2Greg(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
}

// Update to display a Gregorian date
function updateGreg(gregDate) {
  let [y, m, d] = gregDate;
  let int_greg = greg2Int(gregDate);
  let day = (int_greg + 3) % 7;
  gregDateLabel.text = y + "-" + to2(m) + "-" + to2(d) +
    " (" + WEEKDAYS[day] + ")";
  let year_idx = y - MIN_TERM_YEAR;
  if (year_idx >= 0 && year_idx < TERM_YEAR_OFFSETS.length) {
    let daynum = int_greg - greg2Int([y, 1, 1]) + 1
    let term_idx = Math.floor(daynum / 15.3);
    let term_day = Math.floor(TERM_YEAR_OFFSETS[year_idx]
                              + TERM_OFFSETS[term_idx]);
    if (TERM_ERRS[y + "-" + term_idx])
      term_day += 1;
    solarTermLabel.text = (
      (daynum == term_day) ? TERM_NAMES[lunarChar][term_idx] : ""
    );
  }
}

// Update to display a lunar date
function updateLunar(lunarDate) {
  let [yl, ml, dl, ll] = lunarDate;
  if (lunarChar != "Digits")
    yl = STEMS[(yl + 6) % 10] + BRANCHES[(yl + 8) % 12];
  lunarDateLabel.text = "" + yl +
    LEAPS[lunarChar][ll ? 1 : 0] +
    MONTHS[lunarChar][ml - 1] +
    DAYS[lunarChar][dl - 1];
}

let curr;

function updateCurr() {
  updateGreg(curr);
  updateLunar(greg2Lunar(curr));
}

function move2Today() {
  curr = date2Greg(new Date());
  updateCurr();
}

move2Today();
todayButton.onactivate = move2Today;

function inBBoxY(evt, widget) {
  const bbox = widget.getBBox();
  return bbox.top <= evt.screenY && bbox.bottom >= evt.screenY;
}

let downX = 0, downY = 0;

mainSect.onmousedown = function(evt) {
  downX = evt.screenX;
  downY = evt.screenY;
};

let DIFF_TRANS = [0, 1, 7, 30, 365];

mainSect.onmouseup = function(evt) {
  let xMove = evt.screenX - downX;
  let yMove = evt.screenY - downY;
  let diff = 0;
  if (yMove < -60) {
    diff += 3;
  } else if (yMove > 60) {
    diff -= 3;
  }
  if (xMove < -60) {
    diff += 1;
  } else if (xMove > 60) {
    diff -= 1;
  }
  if (diff) {
    diff = diff / Math.abs(diff) * DIFF_TRANS[Math.abs(diff)];
    let intCurr = greg2Int(curr) + diff;
    if (intCurr < LUNAR_START[0])
      intCurr = LUNAR_START[0];
    if (intCurr > LUNAR_START[LUNAR_START.length - 1])
      intCurr = LUNAR_START[LUNAR_START.length - 1];
    curr = int2Greg(intCurr);
    updateCurr();
  } else if (inBBoxY(evt, gregDateLabel) || inBBoxY(evt, gregLabel)) {
    mainSect.style.display = "none";
    let [y, m, d] = curr;
    gregYearTumbler.value = y - UI_YEAR_START;
    gregMonthTumbler.value = m - 1;
    gregDateTumbler.value = d - 1;
    gregSetterSect.style.display = "inline";
  } else if (inBBoxY(evt, lunarDateLabel) || inBBoxY(evt, lunarLabel)) {
    mainSect.style.display = "none";
    let [y, m, d, l] = greg2Lunar(curr);
    lunarYearTumbler.value = y - UI_YEAR_START;
    lunarMonthTumbler.value = m - 1;
    lunarDateTumbler.value = d - 1;
    lunarLeapTumbler.value = l ? 1 : 0;
    lunarSetterSect.style.display = "inline";
  }
};

gregUseButton.onclick = function() {
  curr = [gregYearTumbler.value + UI_YEAR_START,
          gregMonthTumbler.value + 1,
          gregDateTumbler.value + 1];
  updateCurr();
  gregSetterSect.style.display = "none";
  mainSect.style.display = "inline";
}

gregCancelButton.onclick = function() {
  gregSetterSect.style.display = "none";
  mainSect.style.display = "inline";
}

lunarUseButton.onclick = function() {
  let lunar = [lunarYearTumbler.value + UI_YEAR_START,
               lunarMonthTumbler.value + 1,
               lunarDateTumbler.value + 1,
               lunarLeapTumbler.value];
  curr = lunar2Greg(lunar);
  updateCurr();
  lunarSetterSect.style.display = "none";
  mainSect.style.display = "inline";
}

lunarCancelButton.onclick = function() {
  lunarSetterSect.style.display = "none";
  mainSect.style.display = "inline";
}

messaging.peerSocket.addEventListener("message", (evt) => {
  if (evt.data.key == "lunarChar") {
    if (!evt.data.value)
      return;
    lunarChar = evt.data.value["values"][0]["name"];
    updateCurr();
  }
  saveSettings();
});

function saveSettings() {
  fs.writeFileSync("settings.json", [lunarChar], "json");
}
