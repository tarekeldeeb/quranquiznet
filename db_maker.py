# !/usr/bin/env python

"""
    NAME    : Quran Quiz Database Maker
    URL     : Text:  http://tanzil.net
    AUTHORS : Tarek Eldeeb
"""
from typing import List

import requests
import re
import zipfile
from tqdm import tqdm
from random import sample


uthmani_text: str = "quran-uthmani-min.txt"
columns_idx: bool = False


def remove_dialects(s):
  no_dialects = re.sub("[" + chr(0x64B) + "-" + chr(0x65E) + chr(0x670) + "ۦ۟ـۧ" + "]", "", s)
  return re.sub("[" + chr(0x622) + chr(0x623) + chr(0x625) + "]", chr(0x627), no_dialects)


def limited_sample(my_list, limit):
  return my_list if len(my_list) < limit else sample(my_list, limit)


def db_maker():
  # Start by downloading the text from Tanzil.net
  txt_url = "https://tanzil.net/pub/download/index.php?quranType=uthmani-min&outType=txt-2&agree=true"
  req = requests.get(txt_url, allow_redirects=True)
  text = req.content
  open(uthmani_text, "wb").write(text)
  print("Downloaded Quran Text file.")
  text_dial = []
  aya_idx = 0
  aya_dict = {}
  with open(uthmani_text, encoding="utf8") as f:
    for line in f:
      tokens = line.strip().split('|')
      if len(tokens) == 3:
        aya = tokens[2].split(" ")
        aya_dict[aya_idx + len(aya) - 1] = tokens[1]
        aya_idx += len(aya)
        text_dial.extend(aya)
  f.close()
  text_full = remove_dialects(" ".join(text_dial))
  text_no_dialect = text_full.split(" ")
  tot_words = len(text_no_dialect)
  print("Found words: " + str(tot_words))
  json_head = '{"type":"database","name":"qq-noIdx",' \
              '"objects":[{"type":"table","name":"q","ddl":"CREATE TABLE \\"q\\" ' \
              '(\\"_id\\" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,' \
              '\\"txt\\" TEXT NOT NULL,' \
              '\\"txtsym\\" TEXT NOT NULL,' \
              '\\"sim1\\" INTEGER NOT NULL DEFAULT (1),' \
              '\\"sim2\\" INTEGER NOT NULL DEFAULT (0),' \
              '\\"sim3\\" INTEGER NOT NULL DEFAULT (0),' \
              '\\"sim2idx\\" TEXT NULL,' \
              '\\"sim3idx\\" TEXT NULL,' \
              '\\"sim1not2p1\\" TEXT NULL,' \
              '\\"aya\\" INTEGER DEFAULT(NULL))",' \
              '"rows":['
  json_tail = ']}]}'
  jf = open("www/q.json", "w", encoding='utf-8')
  jf.write(json_head)
  for i in tqdm(range(tot_words)):
    row = "[" + str(i + 1) + ",\"" + text_no_dialect[i] + "\",\"" + text_dial[i] + "\","
    sim1 = 0
    sim2 = 0
    sim3 = 0
    sim2idx = []
    sim3idx = []
    sim1not2p1 = []
    sim1not2p1txt = []
    for j in [x for x in range(tot_words) if x != i]:
      if text_no_dialect[i] == text_no_dialect[j]:
        sim1 += 1
        check_index = i < tot_words - 1 and j < tot_words - 1
        if check_index and text_no_dialect[i + 1] == text_no_dialect[j + 1]:
          sim2 += 1
          sim2idx.append(j)
          check_index = i < tot_words - 2 and j < tot_words - 2
          if check_index and text_no_dialect[i + 2] == text_no_dialect[j + 2]:
            sim3 += 1
            sim3idx.append(j)
        else:  # Sim1 but not Sim2, add next unique words
          if j < tot_words - 1 and text_no_dialect[j + 1] not in sim1not2p1txt:
            sim1not2p1.append(j + 1)
            sim1not2p1txt.append(text_no_dialect[j + 1])
    sim2idx = "null" if len(sim2idx) == 0 else "\"[" + ",".join(map(str, limited_sample(sim2idx, 10))) + "]\""
    sim3idx = "null" if len(sim3idx) == 0 else "\"[" + ",".join(map(str, limited_sample(sim3idx, 10))) + "]\""
    sim1not2p1 = "null" if len(sim1not2p1) == 0 else \
      "\"[" + ",".join(map(str, limited_sample(sim1not2p1, 10))) + "]\""
    indexes = sim2idx + "," + sim3idx + "," if columns_idx else ""
    aya_cnt = str(aya_dict[i]) if i in aya_dict else "null"
    comma = "" if i == tot_words - 3 else ","
    row += str(sim1) + "," + str(sim2) + "," + str(sim3) + "," + indexes + sim1not2p1 + "," + aya_cnt + "]" + comma
    jf.write(row)
  jf.write(json_tail)
  jf.close()
  zip_obj = zipfile.ZipFile('www/q.json.zip', 'w', zipfile.ZIP_DEFLATED)
  zip_obj.write('www/q.json')
  zip_obj.close()
  print("Done!")


if __name__ == "__main__":
  db_maker()
