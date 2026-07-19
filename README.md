# ☁️ CloudShop — E-Ticaret Uygulaması

BLM3522 Bulut Bilişim Dersi - Proje 4: E-Ticaret Uygulaması (Otomatik Ölçeklendirme)

## Özellikler
- Ürün listeleme, filtreleme, arama
- Sepet yönetimi (session tabanlı)
- Sipariş oluşturma ve stok güncelleme
- Sipariş geçmişi
- Health check endpoint (Load Balancer için)
- GCP Cloud Run üzerinde otomatik ölçeklendirme

## Teknolojiler
- **Backend:** Node.js, Express.js
- **Veritabanı:** PostgreSQL 16
- **Template:** EJS
- **Container:** Docker
- **Cloud:** GCP Cloud Run + Cloud SQL

## Yerel Kurulum

```bash
# Docker Compose ile (en kolay)
docker compose up -d

# Tarayıcıda aç
open http://localhost:8080
```

## GCP Cloud Run Deployment

### 1. Proje ve API Ayarları
```bash
gcloud config set project PROJE_ID
gcloud services enable run.googleapis.com sqladmin.googleapis.com cloudbuild.googleapis.com
```

### 2. Cloud SQL PostgreSQL Oluşturma
```bash
gcloud sql instances create ecommerce-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=europe-west1

gcloud sql databases create ecommerce --instance=ecommerce-db
gcloud sql users set-password postgres --instance=ecommerce-db --password=SIFRE
```

### 3. DB'yi Başlatma
```bash
gcloud sql connect ecommerce-db --user=postgres
# Sonra db/init.sql içeriğini yapıştır
```

### 4. Docker Image Build & Push
```bash
gcloud builds submit --tag gcr.io/PROJE_ID/cloud-ecommerce
```

### 5. Cloud Run Deploy
```bash
gcloud run deploy cloud-ecommerce \
  --image gcr.io/PROJE_ID/cloud-ecommerce \
  --platform managed \
  --region europe-west1 \
  --allow-unauthenticated \
  --add-cloudsql-instances=PROJE_ID:europe-west1:ecommerce-db \
  --set-env-vars="DB_HOST=/cloudsql/PROJE_ID:europe-west1:ecommerce-db,DB_NAME=ecommerce,DB_USER=postgres,DB_PASS=SIFRE" \
  --min-instances=0 \
  --max-instances=10 \
  --memory=256Mi \
  --port=8080
```

### 6. Otomatik Ölçeklendirme
Cloud Run otomatik olarak:
- 0 instance'dan başlar (min-instances=0)
- Trafik arttıkça 10'a kadar ölçeklenir (max-instances=10)
- Her instance 256MB RAM kullanır
- Trafik yokken 0'a iner (maliyet tasarrufu)

## Proje Yapısı
```
cloud-ecommerce/
├── src/
│   ├── app.js           # Express ana uygulama
│   ├── views/           # EJS template'leri
│   └── public/css/      # Stil dosyaları
├── db/
│   └── init.sql         # Veritabanı şeması + örnek veri
├── Dockerfile
├── docker-compose.yml
└── README.md
```
