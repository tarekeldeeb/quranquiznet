# !/usr/bin/env python

"""
    NAME    : Quran Quiz Database Maker
    URL     : Text:  http://tanzil.net
    AUTHORS : Tarek Eldeeb
"""
import requests
import re
from time import sleep
from tqdm import tqdm

uthmani_text: str = "quran-uthmani-min.txt"


def removeDialects(s):
  nodial = re.sub("[" + chr(0x64B) + "-" + chr(0x65E) + chr(0x670) + "ۦ۟ـۧ" + "]", "", s)
  return re.sub("[" + chr(0x622) + chr(0x623) + chr(0x625) + "]", chr(0x627), nodial)


if __name__ == "__main__":
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
      if (len(tokens) == 3):
        aya = tokens[2].split(" ")
        aya_dict[aya_idx + len(aya) - 1] = tokens[1]
        aya_idx += len(aya)
        text_dial.extend(aya)
  text_full = removeDialects(" ".join(text_dial))
  text_nodial = text_full.split(" ")
  print("Found words: " + str(len(text_nodial)))
  open("2-" + uthmani_text, "w", encoding='utf-8').write(text_full)
  json_head = '{"type":"database","name":"qq-noIdx",' \
              '"objects":[{"type":"table","name":"q","ddl":"CREATE TABLE \\"q\\" ' \
              '(\\"_id\\" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,' \
              '\\"txt\\" TEXT NOT NULL,' \
              '\\"txtsym\\" TEXT NOT NULL,' \
              '\\"sim1\\" INTEGER NOT NULL DEFAULT (1),' \
              '\\"sim2\\" INTEGER NOT NULL DEFAULT (0),' \
              '\\"sim3\\" INTEGER NOT NULL DEFAULT (0),' \
              '\\"aya\\" INTEGER DEFAULT(NULL))",' \
              '"rows":['
  json_tail = ']}]}'
  jf = open("q.json", "w", encoding='utf-8')
  jf.write(json_head)
  for i in tqdm(range(len(text_nodial) - 2)):
    row = "[" + str(i + 1) + ",\"" + text_nodial[i] + "\",\"" + text_dial[i] + "\","
    sim1 = 0
    sim2 = 0
    sim3 = 0
    for j in [x for x in range(len(text_nodial) - 2) if x != i]:
      if text_nodial[i] == text_nodial[j]:
        sim1 += 1
        if text_nodial[i + 1] == text_nodial[j + 1]:
          sim2 += 1
          if text_nodial[i + 2] == text_nodial[j + 2]:
            sim3 += 1
    if i in aya_dict:
      aya_cnt = str(aya_dict[i])
    else:
      aya_cnt = "null"

    if i == len(text_nodial) - 3:
      comma = ""
    else:
      comma = ","
    row += str(sim1) + "," + str(sim2) + "," + str(sim3) + "," + aya_cnt + "]" + comma
    # TODO: Aya
    jf.write(row)
  jf.write(json_tail)
  jf.close()
  print("Done!")
