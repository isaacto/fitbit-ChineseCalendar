// -*- mode: javascript; js-indent-level: 2; -*-

// Date conversion code converted from JS and refactored from the code here:

// https://github.com/wolfhong/LunarCalendar/blob/master/lunarcalendar/converter.py

import document from "document";
import * as fs from "fs";
import * as messaging from "messaging";
import { preferences } from "user-settings";

const mainSect = document.getElementById("main");
const gregLabel = document.getElementById("gregLabel");
const lunarLabel = document.getElementById("lunarLabel");
const gregDateLabel = document.getElementById("gregDate");
const lunarDateLabel = document.getElementById("lunarDate");
const todayButton = document.getElementById("todayButton");

const gregSetterSect = document.getElementById("gregSetter");
const gregYearTumbler = document.getElementById("gregYearTumbler");
const gregMonthTumbler = document.getElementById("gregMonthTumbler");
const gregDateTumbler = document.getElementById("gregDateTumbler");
const gregUseButton = document.getElementById("gregUseButton");

const lunarSetterSect = document.getElementById("lunarSetter");
const lunarYearTumbler = document.getElementById("lunarYearTumbler");
const lunarMonthTumbler = document.getElementById("lunarMonthTumbler");
const lunarDateTumbler = document.getElementById("lunarDateTumbler");
const lunarLeapTumbler = document.getElementById("lunarLeapTumbler");
const lunarUseButton = document.getElementById("lunarUseButton");

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

let lunarChar = "Digits";

try {
  let saved = fs.readFileSync("settings.json", "json");
  lunarChar = saved[0];
  LEAPS[lunarChar][0];
} catch (err) {
  lunarChar = "Digits";
}
console.log(lunarChar);

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
// to be the number of days since an imaginary "adjusted Gregorian date
// 0000-01-00"
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
// bit 12 is month 1, bit 11 is month 2, and so on.  Bit 0 is unused
// if there is no leap month.  The leap month number is indicated in
// bit 13-16.
let LUNAR_MONTHS = [
  0x1694, 0x16aa, 0x4ad5,  // 1888-1890
  0xab6, 0xc4b7, 0x4ae, 0xa56, 0xb52a, // 1891-1900
  0x1d2a, 0xd54, 0x75aa, 0x156a, 0x1096d,
  0x95c, 0x14ae, 0xaa4d, 0x1a4c, 0x1b2a, // 1901-1910
  0x8d55, 0xad4, 0x135a, 0x495d, 0x95c,
  0xd49b, 0x149a, 0x1a4a, 0xbaa5, 0x16a8, // 1911-1920
  0x1ad4, 0x52da, 0x12b6, 0xe937, 0x92e,
  0x1496, 0xb64b, 0xd4a, 0xda8, 0x95b5, // 1921-1930
  0x56c, 0x12ae, 0x492f, 0x92e, 0xcc96,
  0x1a94, 0x1d4a, 0xada9, 0xb5a, 0x56c, // 1931-1940
  0x726e, 0x125c, 0xf92d, 0x192a, 0x1a94,
  0xdb4a, 0x16aa, 0xad4, 0x955b, 0x4ba, // 1941-1950
  0x125a, 0x592b, 0x152a, 0xf695, 0xd94,
  0x16aa, 0xaab5, 0x9b4, 0x14b6, 0x6a57, // 1951-1960
  0xa56, 0x1152a, 0x1d2a, 0xd54, 0xd5aa,
  0x156a, 0x96c, 0x94ae, 0x14ae, 0xa4c, // 1961-1970
  0x7d26, 0x1b2a, 0xeb55, 0xad4, 0x12da,
  0xa95d, 0x95a, 0x149a, 0x9a4d, 0x1a4a, // 1971-1980
  0x11aa5, 0x16a8, 0x16d4, 0xd2da, 0x12b6,
  0x936, 0x9497, 0x1496, 0x1564b, 0xd4a, // 1981-1990
  0xda8, 0xd5b4, 0x156c, 0x12ae, 0xa92f,
  0x92e, 0xc96, 0x6d4a, 0x1d4a, 0x10d65, // 1991-2000
  0xb58, 0x156c, 0xb26d, 0x125c, 0x192c,
  0x9a95, 0x1a94, 0x1b4a, 0x4b55, 0xad4, // 2001-2010
  0xf55b, 0x4ba, 0x125a, 0xb92b, 0x152a,
  0x1694, 0x96aa, 0x15aa, 0x12ab5, 0x974, // 2011-2020
  0x14b6, 0xca57, 0xa56, 0x1526, 0x8e95,
  0xd54, 0x15aa, 0x49b5, 0x96c, 0xd4ae, // 2021-2030
  0x149c, 0x1a4c, 0xbd26, 0x1aa6, 0xb54,
  0x6d6a, 0x12da, 0x1695d, 0x95a, 0x149a, // 2031-2040
  0xda4b, 0x1a4a, 0x1aa4, 0xbb54, 0x16b4,
  0xada, 0x495b, 0x936, 0xf497, 0x1496, // 2041-2050
  0x154a, 0xb6a5, 0xda4, 0x15b4, 0x6ab6,
  0x126e, 0x1092f, 0x92e, 0xc96, 0xcd4a, // 2051-2060
  0x1d4a, 0xd64, 0x956c, 0x155c, 0x125c,
  0x792e, 0x192c, 0xfa95, 0x1a94, 0x1b4a, // 2061-2070
  0xab55, 0xad4, 0x14da, 0x8a5d, 0xa5a,
  0x1152b, 0x152a, 0x1694, 0xd6aa, 0x15aa, // 2071-2080
  0xab4, 0x94ba, 0x14b6, 0xa56, 0x7527,
  0xd26, 0xee53, 0xd54, 0x15aa, 0xa9b5, // 2081-2090
  0x96c, 0x14ae, 0x8a4e, 0x1a4c, 0x11d26,
  0x1aa4, 0x1b54, 0xcd6a, 0xada, 0x95c, // 2091-2100
  0x949d, 0x149a, 0x1a2a, 0x5b25, 0x1aa4,
  0xfb52, 0x16b4, 0xaba, 0xa95b, 0x936, // 2011-2110
  0x1496, 0x9a4b, 0x154a, 0x136a5, 0xda4,
  0x15ac
];

// Each element is the start date of a lunar year, starting with the
// one which starts during solar year START_YEAR.  Bits 0-4 describe
// the day number, bits 5-8 describe the month number, and the
// remaining bits describe the year number.
let LUNAR_START = [
  0xec04c, 0xec23f, 0xec435,  // 1888-1890
  0xec649, 0xec83e, 0xeca51, 0xecc46, 0xece3a, // 1891-1900
  0xed04d, 0xed242, 0xed436, 0xed64a, 0xed83f,
  0xeda53, 0xedc48, 0xede3d, 0xee050, 0xee244, // 1901-1910
  0xee439, 0xee64d, 0xee842, 0xeea36, 0xeec4a,
  0xeee3e, 0xef052, 0xef246, 0xef43a, 0xef64e, // 1911-1920
  0xef843, 0xefa37, 0xefc4b, 0xefe41, 0xf0054,
  0xf0248, 0xf043c, 0xf0650, 0xf0845, 0xf0a38, // 1921-1930
  0xf0c4d, 0xf0e42, 0xf1037, 0xf124a, 0xf143e,
  0xf1651, 0xf1846, 0xf1a3a, 0xf1c4e, 0xf1e44, // 1931-1940
  0xf2038, 0xf224b, 0xf243f, 0xf2653, 0xf2848,
  0xf2a3b, 0xf2c4f, 0xf2e45, 0xf3039, 0xf324d, // 1941-1950
  0xf3442, 0xf3636, 0xf384a, 0xf3a3d, 0xf3c51,
  0xf3e46, 0xf403b, 0xf424e, 0xf4443, 0xf4638, // 1951-1960
  0xf484c, 0xf4a3f, 0xf4c52, 0xf4e48, 0xf503c,
  0xf524f, 0xf5445, 0xf5639, 0xf584d, 0xf5a42, // 1961-1970
  0xf5c35, 0xf5e49, 0xf603e, 0xf6251, 0xf6446,
  0xf663b, 0xf684f, 0xf6a43, 0xf6c37, 0xf6e4b, // 1971-1980
  0xf703f, 0xf7252, 0xf7447, 0xf763c, 0xf7850,
  0xf7a45, 0xf7c39, 0xf7e4d, 0xf8042, 0xf8254, // 1981-1990
  0xf8449, 0xf863d, 0xf8851, 0xf8a46, 0xf8c3b,
  0xf8e4f, 0xf9044, 0xf9237, 0xf944a, 0xf963f, // 1991-2000
  0xf9853, 0xf9a47, 0xf9c3c, 0xf9e50, 0xfa045,
  0xfa238, 0xfa44c, 0xfa641, 0xfa836, 0xfaa49, // 2001-2010
  0xfac3d, 0xfae52, 0xfb047, 0xfb23a, 0xfb44e,
  0xfb643, 0xfb837, 0xfba4a, 0xfbc3f, 0xfbe53, // 2011-2020
  0xfc048, 0xfc23c, 0xfc450, 0xfc645, 0xfc839,
  0xfca4c, 0xfcc41, 0xfce36, 0xfd04a, 0xfd23d, // 2021-2030
  0xfd451, 0xfd646, 0xfd83a, 0xfda4d, 0xfdc43,
  0xfde37, 0xfe04b, 0xfe23f, 0xfe453, 0xfe648, // 2031-2040
  0xfe83c, 0xfea4f, 0xfec44, 0xfee38, 0xff04c,
  0xff241, 0xff436, 0xff64a, 0xff83e, 0xffa51, // 2041-2050
  0xffc46, 0xffe3a, 0x10004e, 0x100242, 0x100437,
  0x10064b, 0x100841, 0x100a53, 0x100c48, 0x100e3c, // 2051-2060
  0x10104f, 0x101244, 0x101438, 0x10164c, 0x101842,
  0x101a35, 0x101c49, 0x101e3d, 0x102051, 0x102245, // 2061-2070
  0x10243a, 0x10264e, 0x102843, 0x102a37, 0x102c4b,
  0x102e3f, 0x103053, 0x103247, 0x10343b, 0x10364f, // 2071-2080
  0x103845, 0x103a38, 0x103c4c, 0x103e42, 0x104036,
  0x104249, 0x10443d, 0x104651, 0x104846, 0x104a3a, // 2081-2090
  0x104c4e, 0x104e43, 0x105038, 0x10524a, 0x10543e,
  0x105652, 0x105847, 0x105a3b, 0x105c4f, 0x105e45, // 2091-2100
  0x106039, 0x10624c, 0x106441, 0x106635, 0x106849,
  0x106a3d, 0x106c51, 0x106e47, 0x10703c, 0x10724f, // 2101-2110
  0x107444, 0x107638, 0x10784c, 0x107a3f, 0x107c53,
  0x107e48
];

// Convert the bit-mapped date as in LUNAR_START to Gregorian date
function bdate2Greg(bdate) {
  return [getBits(bdate, 12, 9), getBits(bdate, 4, 5), getBits(bdate, 5, 0)]
}

// Convert Gregorian date to lunar date, as 4-tuple (y, m, d, l), where
// l is "on" only if the year has a leap month which is m
function greg2Lunar(gregDate) {
  let [y, m, d] = gregDate;
  let index = y - START_YEAR;
  let lstart = LUNAR_START[index];
  if (lstart > ((y << 9) | (m << 5) | d)) {
    lstart = LUNAR_START[--index];
    --y;
  }
  let [lsy, lsm, lsd] = bdate2Greg(lstart);
  let offset = greg2Int(gregDate) - greg2Int([lsy, lsm, lsd]) + 1;
  let lmonth = LUNAR_MONTHS[index];
  let leap_month = getBits(lmonth, 4, 13) || 13;
  let ml = 1;
  for (let i = 0; i < 13; ++i) {
    let num_days = getBits(lmonth, 1, 12 - i) ? 30 : 29;
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
  let lunar_month = LUNAR_MONTHS[index];
  let leap_month = getBits(lunar_month, 4, 13) || 13;
  let offset = 0;
  let num_months = ml;
  if (num_months > leap_month || (num_months == leap_month && ll))
    ++num_months;
  --num_months;
  for (let i = 0; i < num_months; ++i)
    offset += getBits(lunar_month, 1, 12 - i) ? 30 : 29;
  offset += dl;
  return int2Greg(greg2Int(bdate2Greg(LUNAR_START[index])) + offset - 1);
}

// Convert a Javascript Date to Gregorian date
function date2Greg(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
}

// Update to display a Gregorian date
function updateGreg(gregDate) {
  let [y, m, d] = gregDate;
  let day = (greg2Int(gregDate) + 3) % 7;
  gregDateLabel.text = y + "-" + to2(m) + "-" + to2(d) +
    " (" + WEEKDAYS[day] + ")";
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

mainSect.onmouseup = function(evt) {
  let xMove = evt.screenX - downX;
  let yMove = evt.screenY - downY;
  let diff = 0;
  if (yMove < -60) {
    diff = -30;
  } else if (yMove > 60) {
    diff = 30;
  } else if (xMove < -60) {
    diff = -1;
  } else if (xMove > 60) {
    diff = 1;
  } else if (inBBoxY(evt, gregDateLabel) || inBBoxY(evt, gregLabel)) {
    mainSect.style.display = "none";
    let [y, m, d] = curr;
    gregYearTumbler.value = y - UI_YEAR_START;
    gregMonthTumbler.value = m - 1;
    gregDateTumbler.value = d - 1;
    gregSetterSect.style.display = "inline";
    return;
  } else if (inBBoxY(evt, lunarDateLabel) || inBBoxY(evt, lunarLabel)) {
    mainSect.style.display = "none";
    let [y, m, d, l] = greg2Lunar(curr);
    lunarYearTumbler.value = y - UI_YEAR_START;
    lunarMonthTumbler.value = m - 1;
    lunarDateTumbler.value = d - 1;
    lunarLeapTumbler.value = l ? 1 : 0;
    lunarSetterSect.style.display = "inline";
    return;
  }
  if (diff) {
    curr = int2Greg(greg2Int(curr) + diff);
    updateCurr();
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
