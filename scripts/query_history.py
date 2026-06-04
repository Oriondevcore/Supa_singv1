import sqlite3, json
conn = sqlite3.connect(r'C:\Users\Admin\AppData\Local\OpenKJ\OpenKJ\openkj.sqlite')
c = conn.cursor()
c.execute("""SELECT hs.name,h.artist,h.title,SUM(h.plays)as p FROM historySongs h JOIN historySingers hs ON h.historySinger=hs.id WHERE h.artist!='' AND h.title!='' AND hs.name!='' GROUP BY hs.name,h.artist,h.title HAVING p>=2""")
print(json.dumps([dict(zip([x[0] for x in c.description],r)) for r in c.fetchall()]))
conn.close()
