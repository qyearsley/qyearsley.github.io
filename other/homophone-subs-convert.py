#!/usr/bin/env python
# -*- coding: utf8 -*-
# The purpose of this script is to convert a homophone-subs that's formatted in a certain way to an html file that's formatted in a certain way. This is a very limited purpose.

import sys

############################################################################
# Read input

simp2trads = {} # maps (pairs of pinyin and simp char)
                #to dictionaries of trad chars to lists of examples
for line in sys.stdin:
	if line.strip() == "": break # end!
	if line[0] != "\t":
		line = line.strip() # remove newline
		# this is a line like "g-031 发"
		_, simp, pinyin = line.split()
		curr_simp = pinyin, '<span class="simp char">'+simp+'</span>'
		simp2trads[(curr_simp)] = {}
	elif line[1] != "\t":
		# this is a line like "\t發 [fā] launch, start"
		line = line.strip() # remove tab and newline
		trad, rest = line.split(" [")
		pinyin, meaning = rest.split("] ")
		trad = '<span class="trad char">'+trad+'</span>'
		pinyin = '[<span class="pinyin">'+pinyin+'</span>]'
		curr_trad = trad + ' ' + pinyin + ' ' + meaning
		simp2trads[curr_simp][curr_trad] = []
	else:	
		# this is a line like "\t\t出發 [chūfā] to head off"
		line = line.strip() # remove tabs and newline
		trad, rest = line.split(' [')
		pinyin, meaning = rest.split('] ')
		trad = '<span class="trad">'+trad+'</span>'
		pinyin = '[<span class="pinyin">'+pinyin+'</span>]'
		example = trad + ' ' + pinyin + ' ' + meaning
		simp2trads[curr_simp][curr_trad].append(example)

############################################################################
# Output

print '<table border=1>'
print '<tr>'
print '<th width="10%">simplified character</th>'
print '  <th width="30%">traditional character</th>'
print '  <th>examples</th>'
print '</tr>'
for (pinyin, simp) in sorted(simp2trads):
	# count rows
	total_rows = 0
	for trad in simp2trads[(pinyin, simp)]:
		total_rows += len(simp2trads[(pinyin, simp)][trad])
	# print simp char (note rowspan number)
	print '<tr><th rowspan=' + str(total_rows) + '>' + simp + '</th>'
	# print trad chars (note rowspan number)
	for trad in sorted(simp2trads[(pinyin, simp)]):
		print '  <td rowspan=' + str(len(simp2trads[(pinyin, simp)][trad])) + '>',
		print trad + '</td>'
		for example in simp2trads[(pinyin, simp)][trad]:
			print '   <td>' + example + '</td></tr>'
	
print '</table>'
sys.exit (0)

