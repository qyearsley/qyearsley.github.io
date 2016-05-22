#!/usr/bin/env python
# -*- coding: utf8 -*-

import sys


DATA_FILE = 'homophone_subs.txt'


def main():
  lookup = read_data(DATA_FILE)
  print_output(lookup)


def read_data(filename):
  """Reads input into lookup table.

  The dict that this returns maps (pinyin, simplified character) pairs
  to dicts which map traditional characters to lists of examples.
  """
  lookup = {}
  for line in open(filename, 'r'):
    if line.strip() == "":
      break  # end!
    if line[0] != "\t":
      line = line.strip()
      # This is a line like "g-031 发".
      _, simp, pinyin = line.split()
      curr_simp = pinyin, '<span class="simp char">'+simp+'</span>'
      lookup[(curr_simp)] = {}
    elif line[1] != "\t":
      # This is a line like "\t發 [fā] launch, start."
      line = line.strip()
      trad, rest = line.split(" [")
      pinyin, meaning = rest.split("] ")
      trad = '<span class="trad char">'+trad+'</span>'
      pinyin = '[<span class="pinyin">'+pinyin+'</span>]'
      curr_trad = trad + ' ' + pinyin + ' ' + meaning
      lookup[curr_simp][curr_trad] = []
    else:
      # This is a line like "\t\t出發 [chūfā] to head off".
      line = line.strip()
      trad, rest = line.split(' [')
      pinyin, meaning = rest.split('] ')
      trad = '<span class="trad">'+trad+'</span>'
      pinyin = '[<span class="pinyin">'+pinyin+'</span>]'
      example = trad + ' ' + pinyin + ' ' + meaning
      lookup[curr_simp][curr_trad].append(example)
  return lookup


def print_output(lookup):
  print """<table border=1>
  <tr>
  <th width="10%">simplified character</th>
    <th width="30%">traditional character</th>
    <th>examples</th>
  </tr>
  """
  for (pinyin, simp) in sorted(lookup):
    # Count rows.
    total_rows = 0
    for trad in lookup[(pinyin, simp)]:
      total_rows += len(lookup[(pinyin, simp)][trad])
    # Print simplified char (note rowspan number).
    print '<tr><th rowspan=' + str(total_rows) + '>' + simp + '</th>'
    # Print traditional chars (note rowspan number).
    for trad in sorted(lookup[(pinyin, simp)]):
      print '  <td rowspan=' + str(len(lookup[(pinyin, simp)][trad])) + '>',
      print trad + '</td>'
      for example in lookup[(pinyin, simp)][trad]:
        print '   <td>' + example + '</td></tr>'
  print '</table>'


if __name__ == '__main__':
  main()
