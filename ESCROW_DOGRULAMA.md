# 🔒 AidChain Escrow Sistemi Doğrulama Rehberi

## Escrow Nedir?

Escrow (emanet), bağışlarınızın güvenle saklanmasını sağlayan bir sistemdir. Bağışınız:
- ✅ **Pakette kilitli kalır**
- ✅ **Admin keyfi olarak alamaz**
- ✅ **Sadece teslim edildiğinde koordinatöre aktarılır**
- ✅ **Teslim edilmezse geri alabilirsiniz**

## 🔍 Escrow'u Sui Explorer'da Nasıl Doğrularım?

### Adım 1: Transaction'ı Kontrol Et
1. Bağış yaptıktan sonra "Sui Explorer'da Görüntüle" linkine tıklayın
2. Transaction durumunu kontrol edin:
   - ✅ **Status: success** olmalı
   - ❌ **Status: failure** ise bağış yapılmamıştır

### Adım 2: Package Object'i Görüntüle
1. Transaction sayfasında **"Object Changes"** bölümüne bakın
2. `Type: 0x...::aidchain::AidPackage` olan objeyi bulun
3. Package ID'sine tıklayın (örn: `0xdc62a823...`)

### Adım 3: locked_donation Field'ını Kontrol Et
Package detay sayfasında:
```
Fields:
  ...
  locked_donation:
    type: 0x2::coin::Coin<0x2::sui::SUI>
    fields:
      balance: 100000000  (= 0.1 SUI)
      id: 0x...
```

**Önemli Noktalar:**
- ✅ `locked_donation` field'ı varsa → Escrow aktif
- ✅ `balance` değeri bağış miktarına eşitse → Güvende
- ❌ `locked_donation: none` ise → Zaten serbest bırakılmış (teslim edilmiş)

## 📱 UI'da Nasıl Görürüm?

### Bağış Ekranında:
Başarılı bağıştan sonra göreceksiniz:
```
✅ Bağış başarıyla blockchain'e kaydedildi!

🔒 Escrow Aktif!
  ✓ Bağışınız pakette güvenle saklanıyor
  ✓ Sadece teslim edildiğinde koordinatöre aktarılacak
  ✓ Teslim edilmezse geri alabilirsiniz
```

### Koordinatör Panelinde:
```
Bağış Miktarı: 💰 0.1000 SUI

🔒 ESCROW'DA KİLİTLİ
   Pakette güvenle saklanıyor
```

Teslim edildiğinde:
```
Bağış Miktarı: 💰 0.1000 SUI

✓ SERBEST BIRAKILDI
   Koordinatöre aktarıldı
```

## 🛡️ Güvenlik Garantileri

1. **Smart Contract Garantisi**: Bağış Move kodunda kilitli
2. **Blockchain Şeffaflığı**: Herkes kontrol edebilir
3. **Şartlı Serbest Bırakma**: Sadece teslim edildiğinde
4. **Geri Alma Hakkı**: Bağışçı isterse iade alabilir

## 📊 Örnek Doğrulama

**Transaction:** `6QhaPfE16TRh6xNvcZFyDJdz6sYvvNMGzzap99cvXmAe`

1. Explorer'da transaction'ı aç
2. Status: ✅ **success**
3. Object Changes → AidPackage ID'yi kopyala
4. Package sayfasını aç
5. `locked_donation` field'ını gör:
   ```
   balance: 10000000 (0.01 SUI) ← Burada kilitli!
   ```

## ❓ SSS

**S: Sui Explorer'da locked_donation'ı göremiyorum?**
C: "Fields" veya "Content" sekmesine bakın. Bazı durumlarda JSON görünümünde daha net görünür.

**S: Admin bağışı çalabilir mi?**
C: Hayır! Smart contract buna izin vermez. Sadece teslim edildiğinde veya bağışçı iade aldığında çıkar.

**S: Teslim edilmezse ne olur?**
C: Bağışçı `refund_to_donor` fonksiyonunu çağırarak parasını geri alabilir.

**S: Gas ücreti de escrow'da mı?**
C: Hayır, gas ücreti hemen ödenir. Sadece bağış miktarı escrow'da tutulur.

## 🚀 Teknik Detaylar

**Smart Contract:**
```move
public struct AidPackage has key {
    ...
    locked_donation: option::Option<coin::Coin<SUI>>,
    donation_amount: u64,
    ...
}

// Teslimde serbest bırakılır
public entry fun mark_delivered(...) {
    let donation = option::extract(&mut package.locked_donation);
    transfer::public_transfer(donation, package.coordinator);
}
```

**Deployed Contract:**
- Package ID: `0x7615b059d8fc726662be2280a8e336338c82730be2070972d61fa84906a08559`
- Network: Sui Testnet
- Registry: `0xe05fd6498b97b938df1b411b0ecd0e3c7784c5ed38e463e848f0ef1c9658c83e`

---

**Güven değil, kod!** 🔒✨
