import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tempDir = path.join(__dirname, "tmp");

const app = express()

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024 // 5MB
    }
});

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
    </head>
    <body>
        <h1>
            coloque audio aqui
        </h1>
        <input type="file" name="audio" id="audio">
    
        <script>
            const audio = document.querySelector('#audio')
            audio.addEventListener('change',async ()=>{
                const file = audio.files[0];
                const formData = new FormData();
                formData.append("arquivo", file);
            
                await fetch("/musica", {
                  method: "POST",
                  body: formData
                });

                alert('asdasd')
            })
        </script>
    </body>
    </html>`)
})

app.post("/musica", upload.single("arquivo"), (req, res) => {
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFile = path.join(
        tempDir,
        crypto.randomUUID() + path.extname(req.file.originalname)
    );

    fs.writeFileSync(tempFile, req.file.buffer);

    const fpcalc = spawn("./fpcalc", [tempFile]);

    let output = "";
    let error = "";

    fpcalc.stdout.on("data", (data) => {
        output += data.toString();
    });

    fpcalc.stderr.on("data", (data) => {
        error += data.toString();
    });

    fpcalc.on("close", async (code) => {
        fs.unlinkSync(tempFile); // remove o arquivo

        if (code !== 0 || !output) {
            return res.status(500).send(error || "fpcalc falhou");
        }
        console.log(output)

        const durationMatch = output.match(/DURATION=(\d+)/);
        const fingerprintMatch = output.match(/FINGERPRINT=(.+)/);

        if (!durationMatch || !fingerprintMatch) {
            console.error("Não foi possível extrair duração ou fingerprint");
            return;
        }

        const duration = durationMatch[1];
        const fingerprint = fingerprintMatch[1];


        const url = `https://api.acoustid.org/v2/lookup?client=H38r9Qo5Iu&meta=recordings+artists&duration=${duration}&fingerprint=${encodeURIComponent(fingerprint)}`;

        try {
            const res = await fetch(url);
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                const firstResult = data.results[0];
                const recordings = firstResult.recordings || [];

                recordings.forEach(rec => {
                    console.log("Título:", rec.title);
                    if (rec.artists) {
                        rec.artists.forEach(artist => {
                            console.log("Artista:", artist.name);
                        });
                    }
                });
            } else {
                console.log("Nenhum resultado encontrado para esse fingerprint");
            }



        } catch (fetchErr) {
            console.error("Erro ao consultar AcoustID:", fetchErr.message);
        }
        const j = await res.json()
        res.send(JSON.stringify(j));
    });
});

app.listen(3000, () => {
    console.log('Servidor HTTPS rodando em https://localhost:3000');

});

