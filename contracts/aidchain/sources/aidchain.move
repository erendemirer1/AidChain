module aidchain::aidchain {
    use std::string;
    use std::vector;
    use std::option;

    use sui::object;
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::coin;
    use sui::sui::SUI;

    /// Yardım paketinin durumları
    const STATUS_CREATED: u8 = 0;
    const STATUS_IN_TRANSIT: u8 = 1;
    const STATUS_DELIVERED: u8 = 2;

    /// Tüm yardım paketlerinin ID'lerini tutan global registry.
    public struct AidRegistry has key {
    id: object::UID,
    /// Registry'yi ilk oluşturan admin adresi (STK / organizasyon cüzdanı)
    admin: address,
    /// Tüm paketlerin ID'leri
    packages: vector<object::ID>,
}


    /// Tekil bir yardım paketi
    /// Walrus entegrasyonu:
    /// - proof_url: Teslim anındaki fotoğraf / imzalı form gibi kanıtın Walrus URL'si
    /// Escrow: Bağış bu pakette kilitli kalır, teslim edilince coordinatora aktarılır
    public struct AidPackage has key {
        id: object::UID,
        /// Bağışçının adresi
        donor: address,
        /// Paketi yöneten STK / organizasyon adresi
        coordinator: address,
        /// Nihai alıcının adresi (PoC'de opsiyonel)
        recipient: option::Option<address>,
        /// Hangi bölge için (örn: "Hatay/Antakya", "İstanbul/Üsküdar")
        location: string::String,
        /// Kısa açıklama (örn: "Gıda Paketi", "Çocuk bezi + mama")
        description: string::String,
        /// Durum (created / in_transit / delivered)
        status: u8,
        /// Walrus üzerinde saklanan teslim kanıtının URL'si
        proof_url: string::String,
        /// Oluşturulduğu epoch
        created_at_epoch: u64,
        /// Son güncelleme epoch
        updated_at_epoch: u64,
        /// Bağış tutarı (Mist cinsinden)
        donation_amount: u64,
        /// ESCROW: Bağış pakette kilitli - sadece teslimde serbest bırakılır
        locked_donation: option::Option<coin::Coin<SUI>>,
    }

    /// Statü değişim event'i – zincirde izleme için
    public struct AidStatusChanged has copy, drop {
        package_id: object::ID,
        old_status: u8,
        new_status: u8,
        actor: address,
    }

    /// İlk registry'yi oluşturmak için entry fonksiyon.
    /// Bunu deploy'dan sonra sadece 1 kere çağırırsın.
    public entry fun init_registry(ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);

        let registry = AidRegistry {
            id: object::new(ctx),
            admin: sender,
            packages: vector::empty<object::ID>(),
        };

        // Tüm ağ tarafından erişilebilir shared object
        transfer::share_object(registry);
    }

    /// İleride admin'e özel fonksiyon yazarsan kullanırsın (şu an kullanılmıyor)
    fun assert_admin(registry: &AidRegistry, caller: address) {
        assert!(registry.admin == caller, 1);
    }

    /// Yeni yardım paketi + gerçek SUI bağışı
    /// - donation: Coin<SUI> on-chain bağış - PAKETTE KİLİTLİ KALIR
    /// - Sadece teslim edildiğinde coordinator'a aktarılır
    public entry fun donate(
        registry: &mut AidRegistry,
        description: string::String,
        location: string::String,
        coordinator: address,
        donation: coin::Coin<SUI>,
        ctx: &mut TxContext
    ) {
        let donor = tx_context::sender(ctx);
        let now = tx_context::epoch(ctx);
        let amount = coin::value(&donation);

        let package = AidPackage {
            id: object::new(ctx),
            donor,
            coordinator,
            recipient: option::none<address>(),
            location,
            description,
            status: STATUS_CREATED,
            proof_url: string::utf8(b""), // Teslim kanıtı henüz yok
            created_at_epoch: now,
            updated_at_epoch: now,
            donation_amount: amount,
            locked_donation: option::some(donation), // ESCROW: Bağış pakette kilitli
        };

        let package_id = object::id(&package);

        // Registry'ye paketin ID'sini ekle
        vector::push_back(&mut registry.packages, package_id);

        // Paketi shared yap ki durum güncellenebilsin
        // Bağış pakette kaldığı için güvende
        transfer::share_object(package);
    }

    /// Statü güncellemeden önce basit kontrol:
    /// Şimdilik: sadece coordinator statüyü değiştirebilsin.
    fun assert_can_update(package: &AidPackage, actor: address) {
        assert!(package.coordinator == actor, 2);
    }

    public entry fun mark_in_transit(
        package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_can_update(package, sender);

        let old = package.status;
        package.status = STATUS_IN_TRANSIT;
        package.updated_at_epoch = tx_context::epoch(ctx);

        let package_id = object::id(package);

        event::emit(AidStatusChanged {
            package_id,
            old_status: old,
            new_status: STATUS_IN_TRANSIT,
            actor: sender,
        });
    }

    /// Teslim edildi + Walrus proof URL ile kaydet
    /// ÖNEMLİ: Teslimde bağış coordinator'a aktarılır
    public entry fun mark_delivered(
        package: &mut AidPackage,
        proof_url: string::String,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert_can_update(package, sender);

        let old = package.status;
        package.status = STATUS_DELIVERED;
        package.updated_at_epoch = tx_context::epoch(ctx);
        package.recipient = option::some(sender);
        package.proof_url = proof_url;

        // ESCROW RELEASE: Bağış teslimde coordinator'a aktarılır
        if (option::is_some(&package.locked_donation)) {
            let donation = option::extract(&mut package.locked_donation);
            transfer::public_transfer(donation, package.coordinator);
        };

        let package_id = object::id(package);

        event::emit(AidStatusChanged {
            package_id,
            old_status: old,
            new_status: STATUS_DELIVERED,
            actor: sender,
        });
    }

    /// Bağışçı iade talep edebilir (örn: teslim edilemedi, iptal edildi)
    /// Sadece bağışçı çağırabilir ve paket henüz teslim edilmemişse
    public entry fun refund_to_donor(
        package: &mut AidPackage,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        
        // Sadece bağışçı iade alabilir
        assert!(package.donor == sender, 3);
        
        // Paket henüz teslim edilmemişse iade edilebilir
        assert!(package.status != STATUS_DELIVERED, 4);

        // ESCROW REFUND: Bağış bağışçıya iade edilir
        if (option::is_some(&package.locked_donation)) {
            let donation = option::extract(&mut package.locked_donation);
            transfer::public_transfer(donation, package.donor);
        };
    }
}
