#!/usr/bin/env python
# -*- coding: utf8 -*-

"""
The purpose of this script is to convert a homophone-subs that's
formatted in a certain way to an html file that's formatted in another
particular way. This is a very limited purpose.
"""

import sys


def main():
  lookup = read_input()
  print_output(lookup)


def read_input():
  """Read input into lookup table.

  The dict that this returns maps (pinyin, simplified character) pairs
  to dicts which map traditional characters to lists of examples.
  """
  lookup = {}
  for line in sys.stdin:
    if line.strip() == "": break # end!
    if line[0] != "\t":
      line = line.strip() # remove newline
      # this is a line like "g-031 发"
      _, simp, pinyin = line.split()
      curr_simp = pinyin, '<span class="simp char">'+simp+'</span>'
      lookup[(curr_simp)] = {}
    elif line[1] != "\t":
      # this is a line like "\t發 [fā] launch, start"
      line = line.strip() # remove tab and newline
      trad, rest = line.split(" [")
      pinyin, meaning = rest.split("] ")
      trad = '<span class="trad char">'+trad+'</span>'
      pinyin = '[<span class="pinyin">'+pinyin+'</span>]'
      curr_trad = trad + ' ' + pinyin + ' ' + meaning
      lookup[curr_simp][curr_trad] = []
    else:
      # this is a line like "\t\t出發 [chūfā] to head off"
      line = line.strip() # remove tabs and newline
      trad, rest = line.split(' [')
      pinyin, meaning = rest.split('] ')
      trad = '<span class="trad">'+trad+'</span>'
      pinyin = '[<span class="pinyin">'+pinyin+'</span>]'
      example = trad + ' ' + pinyin + ' ' + meaning
      lookup[curr_simp][curr_trad].append(example)


def print_output(lookup):
  print """<table border=1>
  <tr>
  <th width="10%">simplified character</th>
    <th width="30%">traditional character</th>
    <th>examples</th>
  </tr>
  """
  for (pinyin, simp) in sorted(lookup):
    # count rows
    total_rows = 0
    for trad in lookup[(pinyin, simp)]:
      total_rows += len(lookup[(pinyin, simp)][trad])
    # print simp char (note rowspan number)
    print '<tr><th rowspan=' + str(total_rows) + '>' + simp + '</th>'
    # print trad chars (note rowspan number)
    for trad in sorted(lookup[(pinyin, simp)]):
      print '  <td rowspan=' + str(len(lookup[(pinyin, simp)][trad])) + '>',
      print trad + '</td>'
      for example in lookup[(pinyin, simp)][trad]:
        print '   <td>' + example + '</td></tr>'

  print '</table>'


if __name__ == '__main__':
  main()
