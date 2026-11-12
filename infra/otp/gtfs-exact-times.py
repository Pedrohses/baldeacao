"""Marca as frequências do GTFS como exatas (exact_times=1).

O GTFS da SPTrans não tem a coluna exact_times; sem ela o OTP trata cada viagem como
"passa a cada N minutos" sem horário fixo e soma o intervalo inteiro como espera,
o que gera caminhadas longas e saídas adiantadas. Com exact_times=1 o OTP expande
cada faixa em partidas concretas a cada headway.
Uso: python3 gtfs-exact-times.py entrada.zip saida.zip
"""
import csv
import io
import sys
import zipfile

src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "frequencies.txt":
            rows = list(csv.DictReader(io.StringIO(data.decode("utf-8-sig"))))
            out = io.StringIO()
            fields = ["trip_id", "start_time", "end_time", "headway_secs", "exact_times"]
            writer = csv.DictWriter(out, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            for row in rows:
                row["exact_times"] = "1"
                writer.writerow(row)
            data = out.getvalue().encode("utf-8")
            print(f"frequencies.txt: {len(rows)} faixas marcadas com exact_times=1")
        zout.writestr(item.filename, data)
