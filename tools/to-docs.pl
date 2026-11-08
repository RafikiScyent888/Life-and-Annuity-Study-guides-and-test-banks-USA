# Converts the study guide fragments and question banks into Markdown for the Claude Docs.
# Usage: perl tools/to-docs.pl <repo root> <output folder>
use strict; use warnings; use utf8;
binmode STDOUT, ':encoding(UTF-8)';
my ($root, $out) = @ARGV;
mkdir $out;

sub slurp { my $f = shift; local $/; open my $h, '<:encoding(UTF-8)', $f or die "$f: $!"; my $t = <$h>; close $h; $t }
sub spew { my ($f, $t) = @_; open my $h, '>:encoding(UTF-8)', "$out/$f" or die; print $h $t; close $h; print "wrote $f (" . length($t) . " chars)\n" }

# ---- HTML fragment -> Markdown ----
sub inline {
  my $s = shift;
  $s =~ s{<span class="hi">([^<]*)</span>}{($1)}g;
  $s =~ s{<span class="verify">([^<]*)</span>}{($1)}g;
  $s =~ s{<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>}{[$2]($1)}gs;
  $s =~ s{<strong>(.*?)</strong>}{**$1**}gs;
  $s =~ s{<em>(.*?)</em>}{*$1*}gs;
  $s =~ s{<[^>]+>}{}g;
  $s =~ s{&amp;}{&}g; $s =~ s{&middot;}{·}g; $s =~ s{&lt;}{<}g; $s =~ s{&gt;}{>}g;
  $s =~ s{\s+}{ }g; $s =~ s{^\s+|\s+$}{}g;
  $s
}
sub table {
  my $t = shift; my @rows;
  while ($t =~ m{<tr>(.*?)</tr>}gs) {
    my $r = $1; my @c;
    while ($r =~ m{<t[hd][^>]*>(.*?)</t[hd]>}gs) { my $x = inline($1); $x =~ s/\|/\\|/g; push @c, $x }
    push @rows, '| ' . join(' | ', @c) . ' |';
  }
  my $n = () = $rows[0] =~ /\|/g; $n--;
  splice @rows, 1, 0, '| ' . join(' | ', ('---') x $n) . ' |';
  join("\n", @rows)
}
sub section_md {
  my $sec = shift;
  my ($title) = $sec =~ m{<h2>(.*?)</h2>}s;
  $sec =~ s{<div class="topic-head">.*?</div>}{}s;
  my @blocks;
  push @blocks, '## ' . inline($title);
  # walk the top-level elements in order
  while ($sec =~ m{(<h3>.*?</h3>|<div class="table-wrap">.*?</div>|<div class="watch">.*?</div>|<ul>.*?</ul>|<ol>.*?</ol>|<p[^>]*>.*?</p>|<div class="mnemonics">.*</div>\s*(?=</section>|$))}gs) {
    my $el = $1;
    if ($el =~ m{^<h3>(.*?)</h3>}s) { push @blocks, '### ' . inline($1) }
    elsif ($el =~ m{^<div class="table-wrap">}) { push @blocks, table($el) }
    elsif ($el =~ m{^<div class="watch"><strong>Watch out</strong>(.*?)</div>}s) { push @blocks, '**Watch out:** ' . inline($1) }
    elsif ($el =~ m{^<ul>(.*)</ul>}s) { my $l = $1; my @i; push @i, '- ' . inline($1) while $l =~ m{<li>(.*?)</li>}gs; push @blocks, join("\n", @i) }
    elsif ($el =~ m{^<ol>(.*)</ol>}s) { my $l = $1; my @i; push @i, '1. ' . inline($1) while $l =~ m{<li>(.*?)</li>}gs; push @blocks, join("\n", @i) }
    elsif ($el =~ m{^<p}) { push @blocks, inline($el) }
    elsif ($el =~ m{^<div class="mnemonics">}) {
      my @i;
      while ($el =~ m{<div class="mn">(.*?)</p>\s*</div>}gs) {
        my $m = $1; my $word = join '', ($m =~ m{<span[^>]*>([^<]*)</span>}g);
        my ($h) = $m =~ m{<h3>(.*?)</h3>}s; my ($p) = $m =~ m{<p>(.*)$}s;
        push @i, "- **$word** (" . inline($h) . '): ' . inline($p);
      }
      push @blocks, join("\n", @i);
    }
  }
  join("\n\n", @blocks)
}
sub sections {
  my $html = shift; my %by;
  my @order;
  while ($html =~ m{(<section class="topic[^"]*" id="([^"]+)".*?</section>)}gs) { $by{$2} = section_md($1); push @order, $2 }
  (\%by, \@order)
}

# ---- question bank -> Markdown ----
sub bank {
  my $js = slurp(shift);
  my (%topic, %src, @qs);
  $topic{$1} = $2 while $js =~ m{(\w+): \{ name: "([^"]*)", part: "[A-G]" \}}g;
  my %base;
  $base{NCGS} = 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_58/GS_%s.html';
  $base{NCART} = 'https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByArticle/Chapter_58/Article_%s.html';
  while ($js =~ m{(\w+): \{ label: "([^"]*)", url: (?:(NCGS|NCART)\("([^"]+)"\)|"([^"]+)") \}}g) {
    my ($k, $label, $fn, $arg, $url) = ($1, $2, $3, $4, $5);
    $src{$k} = { label => $label, url => $fn ? sprintf($base{$fn}, $arg) : $url };
  }
  for my $line (split /\n/, $js) {
    next unless $line =~ /^\s*(mc|tf|sa)\(/;
    my $type = $1; my @t;
    while ($line =~ m{"((?:[^"\\]|\\.)*)"|\b(true|false)\b}g) { my $v = defined $1 ? $1 : $2; $v =~ s/\\"/"/g; push @t, $v }
    my %q = (type => $type, id => $t[0], topic => $t[1], q => $t[2]);
    if ($type eq 'mc') { @q{qw(opts ans why src)} = ([@t[3..6]], $t[7], $t[8], $t[9]) }
    elsif ($type eq 'tf') { @q{qw(ans why src)} = ($t[3] eq 'true' ? 'True' : 'False', $t[4], $t[5]) }
    else { @q{qw(model src)} = ($t[3], $t[4]) }
    push @qs, \%q;
  }
  (\%topic, \%src, \@qs)
}
sub q_md {
  my ($q, $src) = @_;
  my $s = $q->{src} ? " Source: [$src->{$q->{src}}{label}]($src->{$q->{src}}{url})." : '';
  if ($q->{type} eq 'mc') {
    my @o = @{$q->{opts}}; my $opts = join ' · ', map { ('A'..'D')[$_] . ". $o[$_]" } 0..3;
    return "**$q->{id}.** $q->{q}\n\n$opts\n\n**Answer: $q->{ans}.** $q->{why}$s";
  }
  if ($q->{type} eq 'tf') { return "**$q->{id}.** True or false: $q->{q}\n\n**Answer: $q->{ans}.** $q->{why}$s" }
  return "**$q->{id}.** Short answer: $q->{q}\n\n**Model answer:** $q->{model}$s";
}
sub bank_md {
  my ($topic, $src, $qs, @topics) = @_;
  my @parts;
  for my $t (@topics) {
    my @in = grep { $_->{topic} eq $t } @$qs; next unless @in;
    push @parts, "## $topic->{$t} ($t)\n\n" . join("\n\n", map { q_md($_, $src) } @in);
  }
  join("\n\n", @parts)
}

# NC study guide
my ($nc) = sections(slurp("$root/states/nc/guide-intro.html") . slurp("$root/states/nc/guide-law.html"));
spew('nc-s2-exams.md', $nc->{exam});
spew('nc-s3-life.md', $nc->{'topic-S1'});
spew('nc-s4-health.md', $nc->{'topic-S2'});
spew('nc-s5-numbers.md', $nc->{'state-numbers'});
my ($nt, $ns, $nq) = bank("$root/states/nc/questions.js");
spew('nc-bank-life.md', bank_md($nt, $ns, $nq, 'S1'));
spew('nc-bank-health.md', bank_md($nt, $ns, $nq, 'S2'));

# Shared core study guide
my ($life) = sections(slurp("$root/content/guide-core-life.html"));
my ($health) = sections(slurp("$root/content/guide-core-health.html"));
my ($mem) = sections(slurp("$root/content/guide-memory-aids.html"));
spew('core-s2-life-1-5.md', join("\n\n", map { $life->{"topic-L$_"} } 1..5));
spew('core-s3-life-6-10.md', join("\n\n", map { $life->{"topic-L$_"} } 6..10));
spew('core-s4-health-a.md', join("\n\n", map { $health->{"topic-$_"} } qw(H1 H2 H3 H8)));
spew('core-s5-health-b.md', join("\n\n", map { $health->{"topic-$_"} } qw(H4 H5 H6 H7)));
spew('core-s6-numbers.md', join("\n\n", $life->{'life-numbers'}, $health->{'health-numbers'}, $mem->{'memory-aids'}));
my ($lt, $ls, $lq) = bank("$root/content/core-life.js");
spew('core-bank-life-a.md', bank_md($lt, $ls, $lq, qw(L1 L2 L3)));
spew('core-bank-life-b.md', bank_md($lt, $ls, $lq, qw(L4 L5)));
spew('core-bank-life-c.md', bank_md($lt, $ls, $lq, qw(L6 L7 L8 L9 L10)));
my ($ht, $hs, $hq) = bank("$root/content/core-health.js");
spew('core-bank-health-a.md', bank_md($ht, $hs, $hq, qw(H1 H2 H3)));
spew('core-bank-health-b.md', bank_md($ht, $hs, $hq, qw(H8 H4 H5 H6 H7)));
printf "questions: core life %d, core health %d, NC %d\n", scalar @$lq, scalar @$hq, scalar @$nq;
