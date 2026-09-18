"""Rule-based subtopic tagging for the question bank -> src/data/subtopics.json
Chapter names embedded in pdf_ids are used as priors; a curated dermatology
keyword taxonomy (first match wins, specific before broad) tags the rest;
fallback = the question's category. Deterministic and reviewable."""
import json, glob, re, collections, os
HERE=os.path.dirname(os.path.abspath(__file__)); DATA=os.path.join(HERE,'..','src','data')
qs=[]
for f in sorted(glob.glob(os.path.join(DATA,'*_master.json'))): qs+=json.load(open(f))
# section token -> subtopic (unambiguous chapters)
SEC={'Genodermat':'Genodermatoses','Genode':'Genodermatoses','Bullousand':'Bullous diseases','MedicalMyc':'Fungal infections',
     'PlantsAlle':'Contact dermatitis & allergy','Photobiolo':'Photodermatology','Immunoderm':'Immunodermatology',
     'Dermatopha':'Dermatopharmacology','Dermatopat':'Dermatopathology','Pathol':'Dermatopathology','Dermatop':'Dermatopathology',
     'PediatricD':'Pediatric dermatology','Pediat':'Pediatric dermatology','Pediatri':'Pediatric dermatology',
     'BasicScien':'Basic science','Basic':'Basic science','BasicSci':'Basic science',
     'Therap':'Therapeutics','Therapeu':'Therapeutics','Surger':'Dermatologic surgery','Surgical':'Dermatologic surgery',
     'System':'Skin signs of systemic disease','Naila':'Hair & nail disorders','BenignandM':'Benign & malignant tumours','Neopla':'Benign & malignant tumours'}
# keyword taxonomy — ordered, specific first
TAX=[
 ('Melanoma', r'melanoma|dysplastic n(a)?ev|breslow|lentigo maligna|clark level|sentinel'),
 ('Non-melanoma skin cancer', r'basal cell|squamous cell carcinoma|\bscc\b|\bbcc\b|actinic keratos|bowen|keratoacanthoma|merkel|mohs'),
 ('Cutaneous lymphoma', r'mycosis fungoides|s[ée]zary|cutaneous (t|b)[- ]cell lymphoma|\bctcl\b|lymphomatoid'),
 ('Bullous diseases', r'pemphig|bullous|blister|desmoglein|bp180|bp230|dermatitis herpetiformis|epidermolysis bullosa|linear iga|hailey'),
 ('Drug reactions', r'drug (reaction|eruption|hypersensitivity)|stevens|toxic epidermal|\bten\b|\bdress\b|fixed drug|erythema multiforme|\bagep\b'),
 ('Psoriasis', r'psoria|guttate|palmoplantar pustul|\bpasi\b'),
 ('Acne & rosacea', r'\bacne\b|rosacea|isotretinoin|comedon|hidradenitis|perioral dermatitis'),
 ('Eczema & atopic dermatitis', r'eczema|atopic|seborr?heic dermatitis|nummular|dyshidro|pompholyx|lichen simplex|prurigo nodularis|filaggrin'),
 ('Contact dermatitis & allergy', r'contact dermatitis|patch test|allergen|nickel|urushiol|poison ivy|irritant|latex|fragrance'),
 ('Urticaria & mastocytosis', r'urticaria|angioedema|hives|mastocytosis|urticaria pigmentosa|dermographism'),
 ('Connective tissue disease', r'\blupus\b|dermatomyositis|scleroderma|morphea|systemic sclerosis|sj[öo]gren|mixed connective|antinuclear|\bana\b'),
 ('Vasculitis & vascular disorders', r'vasculitis|purpura|henoch|livedo|panniculitis|erythema nodosum|pyoderma gangrenosum|hemangioma|port[- ]wine|vascular malformation|kaposi|telangiect|behçet|behcet'),
 ('Sexually transmitted infections', r'syphilis|gonorr|chancroid|chlamydia|sexually transmitted|lymphogranuloma|donovanosis|granuloma inguinale|condyloma'),
 ('Bacterial infections & leprosy', r'impetigo|cellulitis|erysipelas|staphylococc|streptococc|leprosy|hansen|tubercul|mycobacter|anthrax|lyme|rickett|actinomyc|nocardi|ecthyma|scarlet|necrotizing fasciitis|scalded skin'),
 ('Viral infections', r'herpes|varicella|zoster|\bhpv\b|\bwart|molluscum|\bhiv\b|measles|hand.foot.and.mouth|coxsackie|epstein|cytomegalo|\bpox\b|verruca|rubella|parvovirus|erythema infectiosum'),
 ('Fungal infections', r'tinea|candid|dermatophyt|onychomycos|malassezia|pityriasis versicolor|sporotrich|chromoblastomyc|mycetoma|histoplasm|blastomyc|coccidioid|cryptococc|mucormyc|\bkoh\b'),
 ('Parasites & infestations', r'scabies|sarcoptes|\blice\b|pediculos|leishmania|larva migrans|myiasis|tungiasis|bed ?bug|cimex|\btick\b|onchocerc|filaria|cysticerc|demodex'),
 ('Genodermatoses', r'ichthyos|neurofibromatosis|tuberous sclerosis|xeroderma pigmentosum|darier|ehlers|marfan|pseudoxanthoma|incontinentia pigmenti|gorlin|cowden|muir[- ]torre|birt[- ]hogg|peutz|autosomal (dominant|recessive)|x[- ]linked|keratoderma|pachyonychia|albinism|bloom syndrome|rothmund'),
 ('Pigmentary disorders', r'vitiligo|melasma|hyperpigment|hypopigment|lentig|caf[ée][- ]au[- ]lait|nevus of ota|ashy dermatosis|piebald|post[- ]inflammatory|dyschromi'),
 ('Hair & nail disorders', r'alopecia|\bhair\b|hirsut|trichotillo|telogen|anagen|planopilaris|frontal fibrosing|scalp|\bnail|onych|paronychia|koilonychia|subungual'),
 ('Photodermatology', r'photo(sensitiv|dermat|therapy|aging|protection)|sunscreen|\buv[ab]?\b|ultraviolet|polymorph(ous|ic) light|porphyria|\bpuva\b|psoralen|actinic prurigo|solar urticaria|\bspf\b'),
 ('Lasers & cosmetic dermatology', r'\blaser\b|botulinum|botox|\bfiller|hyaluronic|chemical peel|dermabrasion|cosmetic|sclerotherapy|microneedl|\bipl\b|cryolipol'),
 ('Dermatologic surgery', r'excision|\bflap\b|\bgraft|suture|cryotherap|electrosurg|electrodes|anesthe|lidocaine|wound clos|\bkeloid|hypertrophic scar|margin'),
 ('Dermatopathology', r'histolog|histopath|dermatopath|immunofluorescence|immunohistochem|microscop|acanthos|spongios|parakerat|hyperkerat|granuloma(?! annulare| inguinale)|civatte|munro|kogoj'),
 ('Skin signs of systemic disease', r'diabet|thyroid|sarcoid|amyloid|xanthoma|paraneoplastic|acanthosis nigricans|necrobiosis|\brenal|hepat|pregnan|internal malignan|cushing|addison|carcinoid|calciphylaxis'),
 ('Oral & genital dermatology', r'\boral\b|mucos|aphth|\bvulv|balanitis|\bgenital|lichen sclerosus|geographic tongue'),
 ('Lichenoid & papulosquamous', r'lichen planus|lichenoid|pityriasis rosea|pityriasis rubra pilaris|pityriasis lichenoides|erythroderma|parapsoriasis|keratosis pilaris|grover'),
 ('Wounds, ulcers & pressure injury', r'\bulcer|wound heal|venous|arterial insuff|pressure (injur|sore)|leg ulcer|compression'),
 ('Sweat & sebaceous gland disorders', r'hyperhidros|miliaria|sebaceous|eccrine|apocrine|bromhidros|fox[- ]fordyce|anhidros'),
 ('Benign tumours & cysts', r'seborrheic keratos|\bcyst|lipoma|dermatofibroma|pyogenic granuloma|syringoma|trichoepithelioma|milia|epidermoid|pilomatri|angioma|xanthelasma|skin tag|acrochordon|nevus sebaceous|neurofibroma'),
 ('Immunodermatology', r'immunolog|cytokine|interleukin|\bil-?\d|complement|\bt[- ]cell|\bb[- ]cell|antibod|\bhla\b|\bth1\b|\bth2\b|\bth17\b|autoimmun|tolerance|mhc'),
 ('Dermatopharmacology', r'methotrexate|cyclosporin|azathioprine|mycophenolate|biologic|adalimumab|dupilumab|secukinumab|ustekinumab|retinoid|acitretin|corticosteroid|prednis|antihistamine|dapsone|hydroxychloroquine|jak inhibitor|mechanism of action|half[- ]life|pharmacol|dosage|\bdose\b'),
 ('Basic science', r'keratinocyte|melanocyte|langerhans|collagen|elastin|basement membrane|embryolog|anatomy|physiolog|epiderm(al|is) (differentiation|barrier)|stratum|desmosome|hemidesmosome|ceramide'),
 ('Pediatric dermatology', r'infant|neonat|\bchild|pediatric|congenital|diaper|birthmark|kawasaki|newborn'),
]
TAXC=[(n,re.compile(p,re.I)) for n,p in TAX]
CATFALL={'Diseases':'General dermatology','Basic':'Basic science','Pathology':'Dermatopathology','Therapeutics':'Therapeutics','Others':'General dermatology','Surgery':'Dermatologic surgery','Immunology':'Immunodermatology','Hair & Nail':'Hair & nail disorders'}
out={}; how=collections.Counter()
for q in qs:
    parts=q['pdf_id'].split('-'); sec=parts[1] if len(parts)>2 else ''
    text=' '.join([q.get('question') or '', q.get('correct_text') or '', (q.get('explanation') or '')[:400]])
    tag=None
    for name,rx in TAXC:
        if rx.search(text): tag=name; break
    if tag is None and sec in SEC: tag=SEC[sec]; how['section']+=1
    elif tag: how['keyword']+=1
    if tag is None: tag=CATFALL.get(q.get('category'),'General dermatology'); how['fallback']+=1
    out[q['pdf_id']]=tag
names=sorted(set(out.values())); idx={n:i for i,n in enumerate(names)}
json.dump({'names':names,'map':{k:idx[v] for k,v in out.items()}}, open(os.path.join(DATA,'subtopics.json'),'w'), separators=(',',':'))
print(f"tagged {len(out)} questions -> {len(names)} subtopics  (keyword={how['keyword']}, chapter={how['section']}, category-fallback={how['fallback']})")
for n,c in collections.Counter(out.values()).most_common(): print(f"  {c:5}  {n}")
print("file:", os.path.getsize(os.path.join(DATA,'subtopics.json'))//1024, "KB")
