FROM python:3.12-slim
RUN pip install --no-cache-dir debugpy==1.8.21
WORKDIR /app
COPY app.py .
EXPOSE 8080 5678
# The debug listener is part of this tutorial image on purpose; in real
# deployments, add debugpy only to the sick pod you are diagnosing (see the
# tutorial's security notes).
CMD ["python", "-m", "debugpy", "--listen", "0.0.0.0:5678", "app.py"]
