from app import create_app
from app.extensions import db
from sqlalchemy import text

app = create_app('development')

with app.app_context():
    print("🚀 Offers (İlanlar) tablosu tamiri başlıyor...")
    
    # 1. Add pickup_start column
    try:
        db.session.execute(text("ALTER TABLE offers ADD COLUMN pickup_start VARCHAR(20);"))
        db.session.commit()
        print("✅ Başarılı: 'pickup_start' sütunu eklendi!")
    except Exception as e:
        db.session.rollback()
        print("⚠️ Bilgi: 'pickup_start' eklenemedi (Zaten var olabilir).")

    # 2. Add pickup_end column
    try:
        db.session.execute(text("ALTER TABLE offers ADD COLUMN pickup_end VARCHAR(20);"))
        db.session.commit()
        print("✅ Başarılı: 'pickup_end' sütunu eklendi!")
    except Exception as e:
        db.session.rollback()
        print("⚠️ Bilgi: 'pickup_end' eklenemedi (Zaten var olabilir).")

    # 3. Add image_url column
    try:
        db.session.execute(text("ALTER TABLE offers ADD COLUMN image_url VARCHAR(500);"))
        db.session.commit()
        print("✅ Başarılı: 'image_url' sütunu eklendi!")
    except Exception as e:
        db.session.rollback()
        print("⚠️ Bilgi: 'image_url' eklenemedi (Zaten var olabilir).")

    print("🏁 Tamir işlemi bitti! Artık run.py çalıştırabilirsin.")