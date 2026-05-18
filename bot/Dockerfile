FROM python:3.12-slim

WORKDIR /app

COPY bot.py ./

RUN python3 -m compileall bot.py

CMD ["python3", "bot.py"]
