#!/usr/bin/env python
# -*- coding: utf8 -*-
# Red from a data file with frequencies of characters in the format:
# char	freq	numbered-pinyin
# And produce an html table of pinyin syllables.

filename = "translit_char_freqs_pronunciation.txt"
toneless_pinyin_to_char = {}  # ie er -> 尔
toneless_pinyin_to_html = {}  # ie er -> <span ... > ... 尔 ... </span>
char_to_numbered_pinyin = {}  # ie 尔 -> er3
char_to_frequency = {}  # ie 尔 -> 232
freq_threshold = 10 # frequency beyond which a character is 'frequent'.

def main():
	datafile = open(filename, 'r')
	for line in datafile:
		values = line.split()
		if len(values) < 3 or line[0] == "#":
			continue
		char, freq, pinyin = values
		toneless_pinyin = pinyin[:-1]
		freq = int(freq)
		char_to_numbered_pinyin[char] = pinyin
		char_to_frequency[char] = freq
		html = "<span title='"+pinyin+"; "+str(freq)+"' "
		if freq > 10:
			html += "class='frequent'>"
		else:
			html += "class='infrequent'>"
		html += char + "</span>"
		if toneless_pinyin in toneless_pinyin_to_char:
			if freq > char_to_frequency[toneless_pinyin_to_char[toneless_pinyin]]:
				toneless_pinyin_to_char[toneless_pinyin] = char
				toneless_pinyin_to_html[toneless_pinyin] = html
		else:
			toneless_pinyin_to_char[toneless_pinyin] = char
			toneless_pinyin_to_html[toneless_pinyin] = html
	print_pinyin_table(toneless_pinyin_to_html)

# Print the table with the given dictionary of syllable to html
def print_pinyin_table(syllable_to_html):
	spellings = generate_spellings()
	final_names = """er a o e ai ei ao ou an en ang eng ong
	i ia iao ie iou ian in iang ing iong
	u ua uo uai uei uan uen uang ueng v ve ve van vn""".split();
	initial_names = "- b p m f d t n l g k h z c s zh ch sh r j q x".split();
	print "<table>"
	print "<tr><th></th>"
	for initial in initial_names:
		print "<th>"+initial+"</th>",
	print "</tr>"
	for final_index in range(len(final_names)):
		print "<tr><th>"+final_names[final_index]+"</th>"
		for initial_index in range(len(initial_names)):
			spelling = spellings[initial_index][final_index]
			if spelling in syllable_to_html:
				print "\t<td>"+syllable_to_html[spelling]+"</td>"
			else:
				print "\t<td></td>"
		print "</tr>"
	print "</table>"

# Generate a 2d list of pinyin spellings. The "rows" are finals, the "columns" are initials.
# The following code will generate lists with impossible syllables.
# This is okay, because only syllables with instances be printed.
def generate_spellings():
	zero_initial_finals =	"""er a o e ai ei ao ou an en ang eng ong
		yi ya yao ye you yan yin yang ying yong
		wu wa wo wai wei wan wen wang weng yu yue yuan yun x""".split();
	normal_finals_spellings ="""er a o e ai ei ao ou an en ang eng ong
		i ia iao ie iu ian in iang ing iong
		u ua uo uai ui uan uen uang ueng v ve ve van vn x""".split();
	jqx_finals_spellings =	"""er a o e ai ei ao ou an en ang eng ong
		i ia iao ie iu ian in iang ing iong
		x ua uo uai ui uan uen uang ueng u ue ue uan un x""".split();
	syllables = [zero_initial_finals]
	for initial in "b p m f d t n l g k h z c s zh ch sh r".split():
		this_initial_list = []
		for final in normal_finals_spellings:
			this_initial_list.append(initial + final)
		syllables.append(this_initial_list)
	for initial in "j q x".split():
		this_initial_list = []
		for final in jqx_finals_spellings:
			this_initial_list.append(initial + final)
		syllables.append(this_initial_list)
	return syllables

main()
