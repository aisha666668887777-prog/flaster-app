import type { SurplusItem, MerchantListing, MerchantPartner } from '../types/index.ts';

export const INITIAL_SURPLUS_ITEMS: SurplusItem[] = [
  {
    id: 'item-sharisha-1',
    title: {
      en: 'Al Sharisha Heritage Dinner Rescue Platter',
      ar: 'بوكس عشاء قصر الشريشة التراثي الفاخر'
    },
    merchant: {
      id: 'merchant-alsharisha-heritage',
      name: 'Al Sharisha Heritage Kitchen',
      nameAr: 'مطعم ومطبخ قصر الشريشة التراثي',
      verified: true,
      rating: 4.95,
      reviewsCount: 268,
      neighborhood: 'Al Sharisha',
      neighborhoodAr: 'الشريشة - رأس الخيمة',
      distanceKm: 0.8,
      avatar: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&auto=format&fit=crop&q=80',
      address: 'Near Al Sharisha Roundabout, Old City, Ras Al Khaimah',
      addressAr: 'بالقرب من دوار الشريشة، شارع المدينة القديمة، رأس الخيمة',
      lat: 25.7925,
      lng: 55.9555
    },
    category: 'buffet',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    discountPercent: 68,
    originalPrice: 110,
    discountedPrice: 35,
    stockRemaining: 4,
    pickupStart: '20:30',
    pickupEnd: '22:30',
    pickupDate: 'today',
    co2SavedKg: 3.8,
    description: {
      en: 'Authentic Emirati culinary surplus prepared daily with premium local meats, saffron-infused fragrant rice, traditional harees, and artisanal sides from our flagship Al Sharisha kitchen.',
      ar: 'وجبة تراثية إماراتية أصيلة من مطبخ الشريشة الفاخر، تتضمن مجبوس اللحم المحلي بالزعفران، هريس إماراتي بالسمن البري، ومقبلات طازجة تم إنقاذها بنهاية الوردية.'
    },
    possibleContents: {
      en: ['Tender local spiced meat majboos', 'Traditional slow-cooked harees', 'Emirati flatbread and fresh laban', 'Date pudding'],
      ar: ['مجبوس لحم بلدي محلي بالهيل والزعفران', 'هريس إماراتي أصيل بالسمن البري', 'خبز رقاق بلدي ولبن أب طازج', 'حلوى التمر اللذيذة']
    },
    allergens: ['Dairy', 'Gluten'],
    ingredients: {
      en: 'Local Emirati Lamb, Basmati Rice, Saffron, Cardamom, Harees Wheat, Local Ghee, Dates',
      ar: 'لحم غنم بلدي، أرز بسمتي، زعفران، هيل، قمح الهريس، سمن بلدي، تمر'
    },
    expiryTime: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Al Sharisha Pilot', 'Emirati Heritage', 'Self-Pickup & Direct Restaurant Delivery']
  },
  {
    id: 'item-1',
    title: {
      en: 'Grand Evening Buffet Mystery Box',
      ar: 'بوكس بوفيه العشاء الفاخر المفاجئ'
    },
    merchant: {
      id: 'merchant-waldorf',
      name: 'Waldorf Astoria Ras Al Khaimah',
      nameAr: 'فندق والدورف أستوريا رأس الخيمة',
      verified: true,
      rating: 4.9,
      reviewsCount: 342,
      neighborhood: 'Al Hamra Village',
      neighborhoodAr: 'قرية الحمراء',
      distanceKm: 1.4,
      avatar: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=120&auto=format&fit=crop&q=80',
      address: 'Vienna St, Al Hamra Village, Ras Al Khaimah',
      addressAr: 'شارع فيينا، قرية الحمراء، رأس الخيمة',
      lat: 25.6882,
      lng: 55.7794
    },
    category: 'buffet',
    imageUrl: 'https://images.unsplash.com/photo-1555244162-803834f70033?w=800&auto=format&fit=crop&q=80',
    discountPercent: 70,
    originalPrice: 185,
    discountedPrice: 55,
    stockRemaining: 2,
    pickupStart: '21:30',
    pickupEnd: '23:00',
    pickupDate: 'today',
    co2SavedKg: 4.2,
    description: {
      en: 'Generous gourmet assortment freshly curated from our signature Qasr Al Bahr dinner buffet right as service concludes. Includes prime grilled mains, warm saffron rice, roasted vegetables, and premium appetizers.',
      ar: 'تشكيلة فاخرة وسخية تم انتقاؤها بعناية من بوفيه عشاء قصر البحر فور انتهاء ساعات الخدمة. تشمل مشويات فاخرة، أرز بالزعفران، خضار مشوية، ومقبلات شهية.'
    },
    possibleContents: {
      en: ['Tender herb-crusted lamb or grilled sea bass', 'Pilaf with pine nuts & saffron', 'Smoked aubergine moutabal & artisanal breads', 'Chef pastry selection'],
      ar: ['لحم ضأن متبل بالأعشاب أو سمك سيباس مشوي', 'أرز بيلاف بالصنوبر والزعفران', 'متبل باذنجان مدخن وخبز طازج', 'مختارات من حلويات الشيف']
    },
    allergens: ['Gluten', 'Dairy', 'Nuts (optional on side)'],
    ingredients: {
      en: 'Lamb / Sea Bass, Basmati Rice, Pine Nuts, Saffron, Eggplant, Tahini, Wheat Flour, Butter',
      ar: 'لحم ضأن / سمك سيباس، أرز بسمتي، صنوبر، زعفران، باذنجان، طحينة، دقيق القمح، زبدة'
    },
    expiryTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Buffet Surplus', 'Premium Dining', 'Chef Handpicked']
  },
  {
    id: 'item-2',
    title: {
      en: 'Artisan Viennoiserie & French Pastry Box',
      ar: 'بوكس المعجنات والكرواسون الفرنسي الفاخر'
    },
    merchant: {
      id: 'merchant-alhamra-patisserie',
      name: 'Al Hamra Artisan Patisserie',
      nameAr: 'مخبوزات الحمراء الحرفية',
      verified: true,
      rating: 4.8,
      reviewsCount: 189,
      neighborhood: 'Al Hamra Mall Promenade',
      neighborhoodAr: 'ممشى الحمراء مول',
      distanceKm: 2.1,
      avatar: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=120&auto=format&fit=crop&q=80',
      address: 'Promenade Level 1, Al Hamra Mall, RAK',
      addressAr: 'مستوى الممشى الأول، الحمراء مول، رأس الخيمة',
      lat: 25.6945,
      lng: 55.7871
    },
    category: 'bakery',
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80',
    discountPercent: 64,
    originalPrice: 78,
    discountedPrice: 28,
    stockRemaining: 3,
    pickupStart: '19:00',
    pickupEnd: '21:00',
    pickupDate: 'today',
    co2SavedKg: 2.4,
    description: {
      en: 'Baked fresh this morning with imported Normandy butter. A delightful surprise assortment of crisp croissants, chocolate swirls, pain aux raisins, and brioche loaves.',
      ar: 'مخبوزة طازجة صباح اليوم باستخدام زبدة النورماندي الفاخرة. تشكيلة مفاجئة ومقرمشة من الكرواسون الكلاسيكي، لفائف الشوكولاتة، والبريوش الذهبي.'
    },
    possibleContents: {
      en: ['2x Butter Croissants', '1x Almond Croissant', '2x Pain au Chocolat', '1x Brioche Bun'],
      ar: ['٢ كرواسون زبدة كلاسيكي', '١ كرواسون لوز فرنسي', '٢ بان أو شوكولا', '١ خبز بريوش طري']
    },
    allergens: ['Gluten', 'Dairy', 'Eggs', 'Almonds'],
    ingredients: {
      en: 'French Wheat Flour, Normandy Butter, Free-Range Eggs, Dark Chocolate, Almonds, Milk, Yeast',
      ar: 'دقيق قمح فرنسي، زبدة نورماندي، بيض طازج، شوكولاتة داكنة، لوز، حليب، خميرة'
    },
    expiryTime: new Date(Date.now() + 7 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Fresh Bakery', 'Artisan Butter', 'Evening Treat']
  },
  {
    id: 'item-3',
    title: {
      en: 'Mediterranean Coastal Dinner Rescue Feast',
      ar: 'وجبة العشاء المتوسطية الساحلية الفاخرة'
    },
    merchant: {
      id: 'merchant-rixos',
      name: 'Rixos Bab Al Bahr',
      nameAr: 'ريكسوس باب البحر',
      verified: true,
      rating: 4.9,
      reviewsCount: 420,
      neighborhood: 'Al Marjan Island',
      neighborhoodAr: 'جزيرة المرجان',
      distanceKm: 3.8,
      avatar: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=120&auto=format&fit=crop&q=80',
      address: 'Al Marjan Island Blvd, Ras Al Khaimah',
      addressAr: 'بوليفارد جزيرة المرجان، رأس الخيمة',
      lat: 25.6698,
      lng: 55.7423
    },
    category: 'buffet',
    imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    discountPercent: 68,
    originalPrice: 160,
    discountedPrice: 50,
    stockRemaining: 1,
    pickupStart: '21:00',
    pickupEnd: '22:30',
    pickupDate: 'today',
    co2SavedKg: 3.9,
    description: {
      en: 'High-end Mediterranean surplus selection featuring tender roast cuts, spiced prawns or calamari, rustic roasted potato wedges, Greek salads, and house-made focaccia.',
      ar: 'مجموعة متوسطية فاخرة فائضة تضم شرائح لحم مشوية طرية، روبيان أو كاليماري بالبهارات، بطاطا مشوية بالأعشاب، سلطات يونانية، وفوكاشيا إيطالية.'
    },
    possibleContents: {
      en: ['Slow-cooked beef brisket or lemon grilled seafood', 'Mediterranean roast vegetables & quinoa', 'Tzatziki & fresh flatbreads'],
      ar: ['لحم بقري مطهو ببطء أو مأكولات بحرية مشوية بالليمون', 'خضار مشوية وكينوا بالأعشاب', 'تزاتزيكي وخبز ساخن']
    },
    allergens: ['Seafood', 'Gluten', 'Dairy'],
    ingredients: {
      en: 'Beef Brisket, Prawns, Quinoa, Olive Oil, Greek Yogurt, Feta Cheese, Focaccia Bread',
      ar: 'لحم بقري، روبيان، كينوا، زيت زيتون، زبادي يوناني، جبنة فيتا، خبز فوكاشيا'
    },
    expiryTime: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['5-Star Resort', 'Low Stock', 'High Protein']
  },
  {
    id: 'item-4',
    title: {
      en: 'Specialty Sourdough & Rustic Loaf Bundle',
      ar: 'باقة خبز الساوردو الحرفي والأرغفة الريفية'
    },
    merchant: {
      id: 'merchant-crust-ferment',
      name: 'Crust & Ferment Micro-Bakery',
      nameAr: 'مخبز كراست للساوردو الطبيعي',
      verified: true,
      rating: 4.7,
      reviewsCount: 95,
      neighborhood: 'Khuzam District',
      neighborhoodAr: 'منطقة خزام',
      distanceKm: 4.5,
      avatar: 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?w=120&auto=format&fit=crop&q=80',
      address: 'Khuzam Road, near Cultural Center, RAK',
      addressAr: 'طريق خزام، قرب المركز الثقافي، رأس الخيمة',
      lat: 25.7654,
      lng: 55.9452
    },
    category: 'bakery',
    imageUrl: 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?w=800&auto=format&fit=crop&q=80',
    discountPercent: 60,
    originalPrice: 65,
    discountedPrice: 26,
    stockRemaining: 4,
    pickupStart: '18:00',
    pickupEnd: '20:00',
    pickupDate: 'today',
    co2SavedKg: 2.1,
    description: {
      en: '36-hour slow fermented sourdough boules, olive & rosemary loaves, and artisanal bagels baked in stone ovens. Perfect for toasting and freezing.',
      ar: 'أرغفة ساوردو مخمرة طبيعياً لمدة ٣٦ ساعة، خبز بالزيتون وإكليل الجبل، وبيغل حرفي مخبوز في أفران الحجر. مثالي للتحميص والتخزين.'
    },
    possibleContents: {
      en: ['1x Country Sourdough Loaf (800g)', '2x Kalamata Olive Rolls', '2x Sourdough Bagels'],
      ar: ['١ رغيف ساوردو ريفي كامل (٨٠٠ جم)', '٢ لفائف زيتون كالاماتا', '٢ بيغل ساوردو']
    },
    allergens: ['Gluten'],
    ingredients: {
      en: 'Organic Stoneground Wheat Flour, Wild Sourdough Starter, Sea Salt, Kalamata Olives, Rosemary',
      ar: 'دقيق قمح عضوي مطحون بالحجر، خميرة ساوردو طبيعية، ملح بحري، زيتون كالاماتا، إكليل الجبل'
    },
    expiryTime: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Wild Yeast', 'No Preservatives', 'Vegan Friendly']
  },
  {
    id: 'item-5',
    title: {
      en: 'Italian Trattoria Antipasti & Pasta Box',
      ar: 'بوكس الباستا الإيطالية والمقبلات الكلاسيكية'
    },
    merchant: {
      id: 'merchant-cove-rotana',
      name: 'Basilico at The Cove Rotana',
      nameAr: 'مطعم باسيليكو - ذا كوف روتانا',
      verified: true,
      rating: 4.9,
      reviewsCount: 310,
      neighborhood: 'Al Dhait South',
      neighborhoodAr: 'الظيت الجنوبي',
      distanceKm: 5.2,
      avatar: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?w=120&auto=format&fit=crop&q=80',
      address: 'The Cove Rotana Resort, Main Coastal Highway, RAK',
      addressAr: 'منتجع ذا كوف روتانا، الطريق الساحلي الرئيسي، رأس الخيمة',
      lat: 25.7410,
      lng: 55.9189
    },
    category: 'gourmet',
    imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
    discountPercent: 66,
    originalPrice: 135,
    discountedPrice: 46,
    stockRemaining: 2,
    pickupStart: '21:00',
    pickupEnd: '22:45',
    pickupDate: 'today',
    co2SavedKg: 3.5,
    description: {
      en: 'Hand-rolled gnocchi, truffle penne, buffalo mozzarella Caprese, and wood-fired focaccia packaged with care by Italian head chefs before nightly closure.',
      ar: 'نيوكي يدوي الصنع، بيني بالكمأة الفاخرة، كابريزي بجبنة الموتزاريلا الطازجة، وفوكاشيا الحطب المجهزة بعناية من الطهاة الإيطاليين.'
    },
    possibleContents: {
      en: ['Fresh Handmade Truffle Pasta or Lasagna Bolognese', 'Grilled Artichoke & Mozzarella Salad', 'Mini Tiramisu cup'],
      ar: ['باستا بالكمأة طازجة أو لازانيا بولونيز غنية', 'سلطة خرشوف مشوي وموتزاريلا', 'كوب تيراميسو صغير']
    },
    allergens: ['Gluten', 'Dairy', 'Eggs'],
    ingredients: {
      en: 'Durum Semolina Pasta, Black Truffle Cream, Buffalo Mozzarella, Tomatoes, Mascarpone, Espresso',
      ar: 'باستا سيمولينا، كريمة الكمأة السوداء، جبنة موتزاريلا، طماطم، ماسكاربوني، إسبريسو'
    },
    expiryTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Gourmet Pasta', 'Authentic Italian', 'Romantic Meal']
  },
  {
    id: 'item-6',
    title: {
      en: 'Cold Brew, Acai & Artisan Sandwich Pack',
      ar: 'باقة القهوة المختصة، الأساي والساندويتش الحرفي'
    },
    merchant: {
      id: 'merchant-seven-waves',
      name: 'Seven Waves Specialty Roastery',
      nameAr: 'محمصة وقهوة الأمواج السبع المختصة',
      verified: true,
      rating: 4.8,
      reviewsCount: 230,
      neighborhood: 'Mina Al Arab Marina',
      neighborhoodAr: 'مارينا ميناء العرب',
      distanceKm: 3.1,
      avatar: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=120&auto=format&fit=crop&q=80',
      address: 'Marina Walk Block 4, Mina Al Arab, RAK',
      addressAr: 'ممشى المارينا، مبنى ٤، ميناء العرب، رأس الخيمة',
      lat: 25.7032,
      lng: 55.8456
    },
    category: 'cafe',
    imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop&q=80',
    discountPercent: 62,
    originalPrice: 75,
    discountedPrice: 28,
    stockRemaining: 5,
    pickupStart: '17:30',
    pickupEnd: '19:30',
    pickupDate: 'today',
    co2SavedKg: 1.8,
    description: {
      en: 'End-of-day cafe surplus package: premium Ethiopian cold brew bottles, gourmet sourdough melt sandwiches, and fresh antioxidant berry acai bowls.',
      ar: 'باقة نهاية اليوم من الكافيه: عبوات كولد برو إثيوبي فاخر، ساندويتشات ساوردو ساخنة ومحشوة، وأطباق أساي غنية بالتوت البري.'
    },
    possibleContents: {
      en: ['1x Signature Cold Brew (330ml)', '1x Turkey & Emmental Sourdough Toastie', '1x Acai or Chia pudding cup'],
      ar: ['١ قهوة كولد برو مميزة (٣٣٠ مل)', '١ توست ساوردو بالديك الرومي والجبن', '١ كوب أساي أو بودينغ الشيا']
    },
    allergens: ['Dairy', 'Gluten'],
    ingredients: {
      en: 'Arabica Coffee, Sourdough Bread, Smoked Turkey, Emmental Cheese, Organic Acai Berry, Chia Seeds',
      ar: 'قهوة أرابيكا، خبز ساوردو، ديك رومي مدخن، جبنة إمنتال، توت أساي عضوي، بذور الشيا'
    },
    expiryTime: new Date(Date.now() + 7 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Specialty Coffee', 'Healthy Options', 'Marina Sunset']
  },
  {
    id: 'item-7',
    title: {
      en: 'Hydroponic Produce & Organic Farm Crate',
      ar: 'صندوق الخضار العضوية والإنتاج المائي الطازج'
    },
    merchant: {
      id: 'merchant-alnakheel-organic',
      name: 'Al Nakheel Organic Harvest',
      nameAr: 'مزارع النخيل العضوية رأس الخيمة',
      verified: true,
      rating: 4.9,
      reviewsCount: 160,
      neighborhood: 'Al Nakheel',
      neighborhoodAr: 'النخيل',
      distanceKm: 6.8,
      avatar: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=120&auto=format&fit=crop&q=80',
      address: 'Al Muntasir St, Al Nakheel, RAK',
      addressAr: 'شارع المنتصر، النخيل، رأس الخيمة',
      lat: 25.7925,
      lng: 55.9691
    },
    category: 'grocery',
    imageUrl: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=800&auto=format&fit=crop&q=80',
    discountPercent: 65,
    originalPrice: 95,
    discountedPrice: 33,
    stockRemaining: 3,
    pickupStart: '17:00',
    pickupEnd: '20:30',
    pickupDate: 'today',
    co2SavedKg: 4.8,
    description: {
      en: 'Crisp pesticide-free greens grown in climate-controlled RAK greenhouses. Harvested this morning with ripe vine tomatoes, bell peppers, fresh mint, and Lebanese cucumbers.',
      ar: 'خضار مقرمشة خالية من المبيدات زُرعت في بيوت محمية حديثة برأس الخيمة. قُطفت صباح اليوم مع طماطم العناقيد، فلفل ألوان، نعناع طازج وخيار بلدي.'
    },
    possibleContents: {
      en: ['1kg Vine Tomatoes', '2 heads Butterhead Lettuce', '500g Sweet Mini Peppers', 'Fresh Basil & Mint bundles'],
      ar: ['١ كجم طماطم عناقيد', '٢ خس باتافيا مقرمش', '٥٠٠ جم فلفل حلو صغير', 'حزم ريحان ونعناع طازج']
    },
    allergens: [],
    ingredients: {
      en: '100% Fresh Organic Vine Tomatoes, Butterhead Lettuce, Sweet Peppers, Basil, Mint',
      ar: 'طماطم عناقيد عضوية ١٠٠٪، خس باتافيا، فلفل حلو، ريحان، نعناع طازج'
    },
    expiryTime: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Local Farm', 'Zero Pesticides', 'Direct from Grower']
  },
  {
    id: 'item-8',
    title: {
      en: 'Artisan Lebanese Mezze & Grill Sunset Box',
      ar: 'بوكس المشاوي والمقبلات اللبنانية عند الغروب'
    },
    merchant: {
      id: 'merchant-albait-alqadeem',
      name: 'Al Bait Al Qadeem Restaurant',
      nameAr: 'مطعم البيت القديم التراثي',
      verified: true,
      rating: 4.7,
      reviewsCount: 275,
      neighborhood: 'Old Corniche',
      neighborhoodAr: 'الكورنيش القديم',
      distanceKm: 7.4,
      avatar: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=120&auto=format&fit=crop&q=80',
      address: 'Old Town Corniche Road, near Heritage Village, RAK',
      addressAr: 'شارع الكورنيش القديم، قرب قرية التراث، رأس الخيمة',
      lat: 25.8012,
      lng: 55.9765
    },
    category: 'gourmet',
    imageUrl: 'https://images.unsplash.com/photo-1541544741938-0af808871cc0?w=800&auto=format&fit=crop&q=80',
    discountPercent: 62,
    originalPrice: 85,
    discountedPrice: 32,
    stockRemaining: 2,
    pickupStart: '20:30',
    pickupEnd: '22:15',
    pickupDate: 'today',
    co2SavedKg: 3.1,
    description: {
      en: 'Freshly barbecued shish tawook skewers, Aleppo kebabs, hummus with tahini, fattoush with pomegranate molasses, and fresh hot saj bread.',
      ar: 'شيش طاووق مشوي على الفحم، كباب حلبي، حمص بالطحينة البلدية، فتوش بدبس الرمان، وخبز صاج ساخن من الفرن مباشرة.'
    },
    possibleContents: {
      en: ['Assorted Mixed Grill (Shish Tawook & Kafta)', 'Velvety Hummus & Fresh Fattoush Salad', 'Fresh Saj Bread & Garlic Toum'],
      ar: ['مشاوي مشكلة (شيش طاووق وكفتة)', 'حمص ناعم وسلطة فتوش طازجة', 'خبز صاج وثومية أصلية']
    },
    allergens: ['Sesame (Tahini)', 'Gluten'],
    ingredients: {
      en: 'Marinated Chicken Breast, Minced Lamb Kafta, Chickpeas, Sesame Tahini, Pomegranate Molasses, Saj Bread',
      ar: 'صدور دجاج متبلة، كفتة لحم غنم، حمص، طحينة السمسم، دبس الرمان، خبز صاج'
    },
    expiryTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    isHalal: true,
    tags: ['Charcoal Grill', 'Heritage Flavor', 'Generous Portion']
  }
];

export const INITIAL_MERCHANT_LISTINGS: MerchantListing[] = [
  {
    id: 'm-1',
    title: 'Grand Evening Buffet Mystery Box',
    titleAr: 'بوكس بوفيه العشاء الفاخر المفاجئ',
    category: 'buffet',
    stock: 2,
    initialStock: 6,
    originalPrice: 185,
    discountedPrice: 55,
    pickupWindow: '21:30 - 23:00',
    expiryTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    allergens: ['Gluten', 'Dairy', 'Nuts'],
    ingredients: 'Lamb, Sea Bass, Saffron Rice, Roasted Vegetables',
    ingredientsAr: 'لحم ضأن، سمك سيباس، أرز بالزعفران، خضار مشوية',
    status: 'active',
    revenueAed: 220
  },
  {
    id: 'm-2',
    title: 'Chef Afternoon Tea Pastry Selection',
    titleAr: 'تشكيلة معجنات شاي بعد الظهيرة للشيف',
    category: 'bakery',
    stock: 0,
    initialStock: 4,
    originalPrice: 120,
    discountedPrice: 40,
    pickupWindow: '18:00 - 19:30',
    expiryTime: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
    allergens: ['Gluten', 'Dairy', 'Eggs'],
    ingredients: 'Wheat Flour, Butter, Eggs, Vanilla Bean, Berries',
    ingredientsAr: 'دقيق القمح، زبدة، بيض، فانيليا، توت طازج',
    status: 'sold_out',
    revenueAed: 160
  },
  {
    id: 'm-3',
    title: 'Executive Seafood & Sushi Platter Box',
    titleAr: 'بوكس السوشي والمأكولات البحرية الفاخر',
    category: 'gourmet',
    stock: 3,
    initialStock: 5,
    originalPrice: 195,
    discountedPrice: 65,
    pickupWindow: '22:00 - 23:30',
    expiryTime: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    allergens: ['Seafood', 'Soy', 'Sesame'],
    ingredients: 'Fresh Salmon, Tuna, Sushi Rice, Nori, Soy Sauce, Wasabi',
    ingredientsAr: 'سلمون طازج، تونة، أرز سوشي، أعشاب بحرية، صويا صوص',
    status: 'active',
    revenueAed: 130
  }
];

export const UAE_LOCATIONS = [
  { id: 'rak_all', name: 'All Ras Al Khaimah', nameAr: 'كل مناطق رأس الخيمة' },
  { id: 'rak_sharisha', name: 'Al Sharisha (Pilot Anchor)', nameAr: 'الشريشة (نواة الإطلاق التجريبي)' },
  { id: 'rak_hamra', name: 'Al Hamra Village', nameAr: 'قرية الحمراء' },
  { id: 'rak_marjan', name: 'Al Marjan Island', nameAr: 'جزيرة المرجان' },
  { id: 'rak_mina', name: 'Mina Al Arab', nameAr: 'ميناء العرب' },
  { id: 'rak_khuzam', name: 'Khuzam & Dhait', nameAr: 'خزام والظيت' },
  { id: 'rak_corniche', name: 'Old Corniche', nameAr: 'الكورنيش القديم' },
  { id: 'rak_nakheel', name: 'Al Nakheel Center', nameAr: 'مركز النخيل' },
];

export const INITIAL_MERCHANT_PARTNERS: MerchantPartner[] = [
  {
    id: 'merchant-alsharisha-heritage',
    name: 'Al Sharisha Heritage Kitchen',
    nameAr: 'مطعم ومطبخ قصر الشريشة التراثي',
    category: 'restaurants_cafeterias',
    neighborhood: 'Al Sharisha',
    neighborhoodAr: 'الشريشة',
    commissionPercent: 10, // Special promotional rate for Al Sharisha launch anchor
    isVerified: true,
    totalSalesAed: 1450,
    activeListingsCount: 1,
    rating: 4.95,
    phone: '+971 7 233 4455',
    iban: 'AE120330000001234567890'
  },
  {
    id: 'merchant-waldorf',
    name: 'Waldorf Astoria Ras Al Khaimah',
    nameAr: 'فندق والدورف أستوريا رأس الخيمة',
    category: 'restaurants_cafeterias',
    neighborhood: 'Al Hamra Village',
    neighborhoodAr: 'قرية الحمراء',
    commissionPercent: 12, // Strategic luxury partner rate
    isVerified: true,
    totalSalesAed: 3850,
    activeListingsCount: 2,
    rating: 4.9,
    phone: '+971 7 203 5555',
    iban: 'AE070860000001234567890'
  },
  {
    id: 'merchant-alhamra-patisserie',
    name: 'Al Hamra Artisan Patisserie',
    nameAr: 'مخبوزات الحمراء الحرفية',
    category: 'bakeries_coffeeshops',
    neighborhood: 'Al Hamra Village',
    neighborhoodAr: 'قرية الحمراء',
    commissionPercent: 15, // Standard bakery commission
    isVerified: true,
    totalSalesAed: 1280,
    activeListingsCount: 1,
    rating: 4.8,
    phone: '+971 7 244 8899',
    iban: 'AE440330000009876543210'
  },
  {
    id: 'merchant-aldhait-green',
    name: 'Al Dhait Fresh Green Grocer',
    nameAr: 'أسواق ومواد غذائية الظيت الخضراء',
    category: 'supermarkets_groceries',
    neighborhood: 'Khuzam & Al Dhait',
    neighborhoodAr: 'خزام والظيت',
    commissionPercent: 12, // Supermarket volume rate
    isVerified: true,
    totalSalesAed: 960,
    activeListingsCount: 1,
    rating: 4.75,
    phone: '+971 7 235 6677',
    iban: 'AE550330000004561237890'
  },
  {
    id: 'merchant-umrashid-home',
    name: 'Um Rashid Emirati Kitchen (Home Business)',
    nameAr: 'مطبخ أم راشد للأكلات التراثية (مشروع منزلي)',
    category: 'home_businesses',
    neighborhood: 'Al Sharisha',
    neighborhoodAr: 'الشريشة',
    commissionPercent: 8, // Subsidized empowerment rate for Emirati home ventures
    isVerified: true,
    totalSalesAed: 640,
    activeListingsCount: 1,
    rating: 5.0,
    phone: '+971 50 889 4433',
    iban: 'AE770330000003322114455'
  },
  {
    id: 'merchant-alnakheel-roastery',
    name: 'Al Nakheel Roastery & Specialty Cafe',
    nameAr: 'محمصة ومقهى النخيل المختص',
    category: 'bakeries_coffeeshops',
    neighborhood: 'Al Nakheel',
    neighborhoodAr: 'مركز النخيل',
    commissionPercent: 15, // Standard cafe rate
    isVerified: true,
    totalSalesAed: 820,
    activeListingsCount: 1,
    rating: 4.85,
    phone: '+971 7 222 1199',
    iban: 'AE880330000006655443322'
  },
  {
    id: 'merchant-qasralsham',
    name: 'Qasr Al Sham Charcoal Bakery & Kitchen',
    nameAr: 'مخبز ومطعم قصر الشام للمشاوي والمعجنات',
    category: 'restaurants_cafeterias',
    neighborhood: 'Khuzam & Al Dhait',
    neighborhoodAr: 'خزام والظيت',
    commissionPercent: 14,
    isVerified: true,
    totalSalesAed: 1120,
    activeListingsCount: 1,
    rating: 4.7,
    phone: '+971 7 236 9911',
    iban: 'AE990330000007788990011'
  }
];
