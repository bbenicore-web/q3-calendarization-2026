# Календаризация команд — 3Q 2026

Интерактивная таблица ресурсов и пересечений между командами (МегаИнтернет, Монетизация, ДИ, Роуминг/VAS).

## GitHub Pages

Сайт публикуется автоматически из ветки `main`, папка `/`.

После push откройте: **Settings → Pages → Build and deployment → Source: Deploy from branch → main → / (root)**

URL будет: `https://<username>.github.io/q3-calendarization-2026/`

## Локальный запуск

```bash
python3 -m http.server 8080
```

Откройте http://localhost:8080

## Файлы

- `index.html` — основная страница (загружает `data.json`)
- `data.json` — данные календаризации
- `index-standalone.html` — версия в одном файле (без data.json)

## Обновление данных

Перегенерируйте `data.json` из Excel-файлов и сделайте commit.
