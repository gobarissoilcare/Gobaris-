// What the website says before anyone changes it in the admin panel.
// These match the text written into ../index.html, which the site still shows
// whenever the server can't be reached. The admin panel starts from these.
const SITE = {
  "announcement": {
    "enabled": false,
    "text": "",
    "link": ""
  },
  "hero": {
    "title": "Gobar to *Goodness*",
    "subtitle": "From temple town soil, a living compost.",
    "lede": "Gobaris turns Braj's cow dung into vermicompost the old way — worms, microbes, and patience. No shortcuts, no chemical fillers. Just soil that remembers how to grow things."
  },
  "shopIntro": "A preview of what buying Gobaris will look like — prices and stock counts shown here are for demo purposes; checkout isn't connected to real payment yet.",
  "cowCare": {
    "percent": "2",
    "caption": "of everything we earn goes back to the cows",
    "heading": "We give back to the cows who give us everything.",
    "body": "Every bag of Gobaris begins with the cows of Braj. Their gobar feeds our worms, our worms feed the soil, and the soil feeds all of us. So it is only right that the cows are fed first. That is why **2% of everything Gobaris earns goes straight to cow welfare** — to the gaushalas and caretakers who look after them every day.",
    "points": [
      {
        "title": "Food",
        "text": "Fresh fodder, green grass and clean water"
      },
      {
        "title": "Shelter",
        "text": "Safe, shaded and cared-for gaushalas"
      },
      {
        "title": "Care",
        "text": "Treatment, medicine and everyday needs"
      }
    ],
    "note": "So every time you choose Gobaris, you are not only feeding your soil — you are feeding a cow too."
  },
  "contact": {
    "intro": "Wholesale, retail, or bulk for farms — tell us the quantity and we'll sort the rest. Based in Vrindavan, shipped across India.",
    "name": "Harsh Chittoudiya",
    "phone": "+91 95205 62691",
    "email": "chittoudiyaharsh.2602@gmail.com",
    "whatsapp": "919520562691"
  }
};

const FACTS = {
  "fun": [
    "One teaspoon of healthy soil can hold more living organisms than there are people on Earth.",
    "Earthworms can eat up to their own body weight in organic matter every single day — nature's original recyclers.",
    "Soil isn't dirt. It's alive — made of minerals, water, air, and billions of microbes all working together.",
    "A single earthworm can pass its own body weight in soil through its gut every 24 hours, leaving richer soil behind.",
    "It can take nature over 500 years to naturally build just 2–3 centimetres of topsoil.",
    "Earthworms have no eyes or lungs — they breathe and sense light entirely through their skin.",
    "Farmers have called vermicompost ‘black gold’ for generations — a single handful can carry millions of beneficial microbes.",
    "Healthy soil can hold water like a sponge — improving its structure just a little can dramatically cut water waste in farming.",
    "Charles Darwin spent the last years of his life studying earthworms, calling them one of the most important creatures in the history of the world.",
    "Scientists have identified more than 6,000 species of earthworms living around the world.",
    "Earthworms have five pairs of tiny hearts that pump blood through their bodies.",
    "Compost worms like red wigglers are a different species from the earthworms you find digging deep in garden soil.",
    "Worm burrows act like tiny tunnels that help air and water move deeper into the ground.",
    "Topsoil is sometimes called the “skin of the earth” — a thin, living layer that almost everything depends on.",
    "A single gram of healthy soil can contain billions of microorganisms, more than the number of people who have ever lived.",
    "Beneath the surface, fungi and bacteria form vast underground networks that help plants exchange nutrients with each other.",
    "Soil is home to an estimated one quarter of all the species known on Earth.",
    "Healthy soil can store more carbon underground than what's held in the atmosphere and all the world's plants combined.",
    "According to legend, earthworms were considered sacred in ancient Egypt, and removing them from the land was forbidden.",
    "Earthworms are hermaphrodites — each one has both male and female reproductive organs.",
    "Worm castings are so fine and nutrient-dense that some gardeners use them straight as a seed-starting mix.",
    "Earthworms move through soil using tiny bristles called setae to grip and push themselves forward.",
    "A healthy compost pile can reach internal temperatures of over 60°C as microbes break down organic matter.",
    "Unlike synthetic fertilizer, which can wash away in the rain, compost binds to soil and releases nutrients slowly over time.",
    "Some earthworm species can regenerate part of their body if it's lost — though not their whole self, despite the popular myth."
  ],
  "product": [
    "Vermicompost is made by earthworms breaking down organic matter into nutrient-rich castings — one of the oldest natural fertilizers known.",
    "Unlike chemical fertilizers, vermicompost feeds the soil's microbiome — so the soil keeps getting healthier, season after season.",
    "Good compost follows one simple formula: moisture + time + organic matter = soil that remembers how to grow things.",
    "Vermicompost improves soil structure, water retention, and root growth all at once — no chemical shortcuts needed.",
    "Worm castings are rich in nitrogen, phosphorus, and potassium in forms plants can absorb almost immediately.",
    "Composting with earthworms speeds up decomposition dramatically compared to a regular compost pile — weeks instead of months.",
    "Vermicomposting works best between about 15–25°C — too hot, and the worms will try to escape or won't survive.",
    "Overfeeding a worm bin is one of the most common mistakes — it can turn the pile anaerobic and start to smell.",
    "A properly balanced worm bin has almost no bad odor at all; smell usually signals too much moisture or too much food.",
    "Finished vermicompost typically has a neutral pH, which makes it safe to use with almost any plant.",
    "It usually takes 8 to 12 weeks for organic waste to fully break down into finished vermicompost.",
    "Vermicompost releases nutrients slowly, feeding plants over weeks rather than all at once like synthetic fertilizer.",
    "Worms digest food using a muscular gizzard that grinds organic matter, much like a bird's gizzard grinds seeds.",
    "Vermicompost tea, made by steeping castings in water, is often used as a natural liquid fertilizer for plants.",
    "Curing time after active composting lets beneficial microbes stabilize, which makes the compost gentler on young seedlings.",
    "Finished compost stops generating heat and takes on a dark, crumbly texture with an earthy smell — both signs it's ready to use.",
    "Turning or aerating a compost pile regularly helps keep it oxygen-rich, which speeds up decomposition.",
    "Composting organic waste produces far less methane than the same waste rotting in a sealed landfill.",
    "Worm castings can hold several times their own weight in water, helping soil stay moist for longer.",
    "Vermicompost is considered a soil conditioner as much as a fertilizer — it improves structure, not just nutrient content.",
    "A wrung-out-sponge level of moisture is the benchmark composters use to judge if a pile is damp enough without being soggy.",
    "Vermicompost can help improve a plant's natural resistance to certain pests and diseases by strengthening root development.",
    "The carbon-to-nitrogen ratio of compost inputs — roughly 25 to 30 parts carbon per 1 part nitrogen — determines how efficiently a pile breaks down.",
    "Vermicompost doesn't just feed this season's crop — because it builds organic matter in the soil, its benefits carry over into future harvests.",
    "Bigger isn't always better in composting — smaller batches are easier to keep evenly moist and aerated than large ones."
  ]
};

const FOUNDERS = [
  {
    "name": "Harsh Chittoudiya",
    "role": "Co-Founder",
    "email": "chittoudiyaharsh.2602@gmail.com",
    "linkedin": "https://in.linkedin.com/in/harsh-chittoudiya-50aa72196"
  },
  {
    "name": "Dr. Aditi Gupta",
    "role": "Co-Founder",
    "email": "aditi08041998@gmail.com",
    "linkedin": ""
  }
];

module.exports = { DEFAULTS: { site: SITE, facts: FACTS, founders: FOUNDERS } };
