#!/usr/bin/env python3

# This program is the source of the magical numbers detecting solar
# terms in the program.  It finds the year offsets and term offsets
# which fits the term dates of HKO the best it can find.  The "fit" is
# in term of a formula "term-date = int(year-offset + term-offset)"
# for the 24 term offsets for each term (the first is fixed at 0) and
# the 200 year offsets for each year, and the date is expressed in
# number of days since Jan 1.  We require that errors are always in
# the form that the formula produces a date earlier than the HKO date
# by 1 day.  Then the year offsets are rounded as much as possible
# without affecting the errors.  The found offsets and errors are then
# printed in the form usable in Javascript.  The result can then be
# inserted to the actual Javascript program.

# To reduce the number of dates with an error, an error function is
# defined, as the (fractional) number of days required to make the
# year-offset + term-offset lie within the range [actual-date - 5e-4,
# actual-date + 1 - 5e-4], taken to a certain power, and multiplied by
# 8 if it is in the wrong direction.  Then scipy.optimize.minimize is
# used in 3 stages, for power of 2, 1.5, and then 1.  In each stage
# the optimization is done until scipy.optimize gives up (the
# tolerance is so tight that it can never be reached).  The three
# stage strategy is used to speed up convergence.

import collections
import datetime
import json
import re
import subprocess
import sys
import typing

import numpy as np
import scipy.optimize as so


def get_err(year_term_daynums, power, params):
    lparams = list(params)
    term_offsets = np.array([0] + lparams[0:23])
    year_offsets = lparams[23:]
    ret = 0
    for year, term_daynums in year_term_daynums.items():
        ret += year_cost(year, term_daynums, term_offsets, year_offsets,
                         year_term_daynums, power)
    return ret


def year_cost(year, term_daynums, term_offsets, year_offsets,
              year_term_daynums, power):
    year_idx = year - min(year_term_daynums)
    derived_offsets = year_offsets[year_idx] + term_offsets
    early_cost = np.mean(np.maximum(term_daynums - derived_offsets + 5e-4, 0)
                         ** power)
    late_cost = np.mean(np.maximum(derived_offsets - term_daynums - 1 + 5e-4, 0)
                        ** power * 8)
    return early_cost + late_cost


with open('fetched/solar-terms.json') as fin:
    term_data = json.load(fin)
year_term_daynums = {
    int(ystr): np.array(daynums)
    for ystr, daynums in term_data['years'].items()
}
curr = [(idx + 1) * 15 for idx in range(23)] + [5] * (len(year_term_daynums))


def show(year_term_daynums, term_data, arr):
    lparams = list(arr)
    term_offsets = np.array([0] + lparams[0:23])
    year_offsets = lparams[23:]
    errs = {}
    for year, term_daynums in list(year_term_daynums.items()):
        year_idx = year - min(year_term_daynums)
        derived_offsets = (year_offsets[year_idx] + term_offsets).astype(int)
        for idx in range(len(derived_offsets)):
            if derived_offsets[idx] != term_daynums[idx]:
                err = term_daynums[idx] - derived_offsets[idx]
                assert err == 1, f'Unexpected error: {year} {idx} {err}'
                errs[f'{year}-{idx}'] = 1
        for ndec in range(8):
            rounded = round(year_offsets[year_idx], ndec)
            rounded_offsets = (rounded + term_offsets).astype(int)
            if (derived_offsets == rounded_offsets).all():
                year_offsets[year_idx] = rounded
                break
    print(f'TERM_ERRS = {errs};')
    print(f'TERM_OFFSETS = {list(term_offsets)};')
    print(f'YEAR_OFFSETS = {year_offsets};')


if __name__ == '__main__':
    def _errfun(x):
        return get_err(year_term_daynums, power, x)
    def _f(curr):
        print(f'{curr} => err{power} {_errfun(curr)}')
    curr = np.array(curr)
    power = 2
    curr = so.minimize(_errfun, np.array(curr), callback=_f, tol=1e-10).x
    power = 1.5
    curr = so.minimize(_errfun, curr, callback=_f, tol=1e-10).x
    power = 1
    curr = so.minimize(_errfun, curr, callback=_f, tol=1e-10).x
    show(year_term_daynums, term_data, curr)
