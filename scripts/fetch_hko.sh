#!/usr/bin/env bash

URL=https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/%de.pdf
TARGET_DIR=fetched

for y in $(seq 1901 2100); do
    if [[ ! -f "${TARGET_DIR}/${y}e.pdf" ]]; then
        echo "Fetching ${y}e.pdf"
        wget -q -O "${TARGET_DIR}/${y}e.pdf" $(printf "${URL}\n" $y)
        sleep 1
    fi
done

cat <<EOF | python3 -
import datetime
import json
import re
import subprocess

TERMS = ['Moderate Cold',
         'Severe Cold',
         'Spring Commences',
         'Spring Showers',
         'Insects Waken',
         'Vernal Equinox',
         'Bright & Clear',
         'Corn Rain',
         'Summer Commences',
         'Corn Forms',
         'Corn on Ear',
         'Summer Solstice',
         'Moderate Heat',
         'Great Heat',
         'Autumn Commences',
         'End of Heat',
         'White Dew',
         'Autumnal Equinox',
         'Cold Dew',
         'Frost',
         'Winter Commences',
         'Light Snow',
         'Heavy Snow',
         'Winter Solstice']

TERM_MONTHS = {term: i // 2 + 1 for i, term in enumerate(TERMS)}

MATCHER = re.compile(r'(%s): ?([0-9]+)' % ('|'.join(TERMS)))


data = {'terms': TERMS, 'years': {}}
for year in range(1901, 2101):
    inf = f"${TARGET_DIR}/{year}e.pdf"
    out = subprocess.run(['pdftotext', inf, '/dev/stdout'],
                         capture_output=True, text=True, check=True).stdout
    out = re.sub('\uff1a', ':', out)
    out = re.sub(r'\s+', ' ', out)
    out = re.sub(r' Lunar ', ' ', out)
    matches = dict(MATCHER.findall(out))
    assert len(matches) == 24
    term_daynums = [0] * 24
    for idx, term in enumerate(TERMS):
        month = TERM_MONTHS[term]
        day = int(matches[term])
        if (year, month, day) == (2048, 11, 2):
            day = 21
        date = datetime.date(year, month, day)
        term_daynums[idx] = (date - datetime.date(year, 1, 1)).days + 1
    data['years'][year] = term_daynums

with open(f"${TARGET_DIR}/solar-terms.json", "wt") as fout:
    json.dump(data, fout)

EOF
