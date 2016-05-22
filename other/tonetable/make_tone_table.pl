#!/usr/bin/env perl
# Input: A data file where each row is like:
#   啊\t123\ta1
# Output: A HTML table of hanzi grouped by tone.

use strict;
use warnings;

# Get the data from the file.
open(DATA, "frequency_pinyin_table.txt");
my %SYLLABLES = ();
while (my $record = <DATA>) {
    next if ($record =~ /^\s*$/ || $record =~ /^#/);
    my ($zi, $rank, $pinyin) = ($record =~ m/^(\S+)\s(\d+)\s(\S+)/);
    $rank = int($rank);
    my $is_primary = !($pinyin =~ m/[*]$/);
    my $freq = frequency_level($rank);
    my $is_frequent = ($freq < 6);
    if ($is_primary and $is_frequent) {
        my ($syll, $tone) = ($pinyin =~ m/^(.+)(\d)$/);
        $tone = int($tone);
        $tone = 0 if $tone == 5;
        $SYLLABLES{$syll}[$tone][$freq] .= $zi;
    }
}
close(DATA);

# Assign a level of a character based on it's rank in an ordered list
# From most to least frequent.
sub frequency_level {
    my $rank = shift;
    return 0 if ($rank < 250);
    return 1 if ($rank < 500);
    return 2 if ($rank < 1000);
    return 3 if ($rank < 1500);
    return 4 if ($rank < 2000);
    return 5 if ($rank < 2500);
    return 6;
}

# Generate and output the html.
sub print_row;
sub join_initial_final;
my @initials = split /\s/,
    "- b p m f d t n l g k h z c s zh ch sh r j q x";
my @finals = split /\s/,
    "a o e ai ei ao ou an en ang eng ong
    i ia iao ie iou ian in iang ing iong
    u ua uo uai ui uan uen uang ueng v ve van vn";
print "<table>\n";
print "<tr><th></th><th>0</th><th>1</th><th>2</th><th>3</th><th>4</th></tr>\n";
print_row "er";
for my $final (@finals) {
    for my $initial (@initials) {
        my $syllable = join_initial_final($initial, $final);
        my $has_entry = $SYLLABLES{$syllable};
        print_row $syllable if $has_entry;
    }
}
print "</table>";

# Given one scalar syllable, print suitable html tr element.
sub print_row {
    my $syllable = shift;
    print "<tr><th class='syllable'>$syllable</th>\n";
    for my $tone (0..4) {
        if (!$SYLLABLES{$syllable}[$tone]) {
            print "\t<td class='tone$tone' class='empty'></td>\n";
        } else {
            print "\t<td class='tone$tone'>";
            for my $freq (0..5) {
                my $hanzi = $SYLLABLES{$syllable}[$tone][$freq];
                print "<span class='freq$freq'>$hanzi</span>" if $hanzi;
            }
            print "</td>\n";
        }
    }
    print "</tr>\n";
}

# Given initial and final, return the standard way of writing in pinyin.
sub join_initial_final {
    my ($init, $fin) = @_;
    if ($init =~ m/-/) {
        $fin =~ s/^u$/wu/;
        $fin =~ s/^i$/yi/;
        $fin =~ s/^ui$/wei/;
        $fin =~ s/^v/yu/;
        $fin =~ s/^i/y/;
        $fin =~ s/^u/w/;
        $init = "";
    } else {
        $fin =~ s/^iou/iu/;
        $fin =~ s/^uen/un/;
    }
    if ($init =~ m/[jqx]/) {
        $fin =~ s/^u/X/;
        $fin =~ s/v/u/;
    }
    return $init . $fin;
}
