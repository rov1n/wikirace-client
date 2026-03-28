// src/dailyPairs.js

export const DAILY_PAIRS = [
  // --- WEEK 1: Pop Culture to Hard Science ---
  { start: 'SpongeBob_SquarePants', target: 'Quantum_entanglement', optimal: 7 },
  { start: 'Taylor_Swift', target: 'Plate_tectonics', optimal: 7 },
  { start: 'Fortnite', target: 'Mitochondrion', optimal: 8 },
  { start: 'Shrek', target: 'Thermodynamics', optimal: 7 },
  { start: 'Crocs', target: 'Black_hole', optimal: 8 },
  { start: 'TikTok', target: 'String_theory', optimal: 8 },
  { start: 'Barbie', target: 'Apollo_11', optimal: 7 },

  // --- WEEK 2: History to Modern Tech ---
  { start: 'Genghis_Khan', target: 'Bluetooth', optimal: 8 },
  { start: 'French_Revolution', target: 'React_(JavaScript_library)', optimal: 8 },
  { start: 'Cleopatra', target: 'Artificial_neural_network', optimal: 9 },
  { start: 'Aztec_Empire', target: 'Bitcoin', optimal: 7 },
  { start: 'Black_Death', target: '5G', optimal: 8 },
  { start: 'Julius_Caesar', target: 'Tesla,_Inc.', optimal: 7 },
  { start: 'Stonehenge', target: 'Cybersecurity', optimal: 8 },

  // --- WEEK 3: Everyday Items to Abstract Concepts ---
  { start: 'Toothbrush', target: 'Nihilism', optimal: 8 },
  { start: 'Toaster', target: 'Existentialism', optimal: 7 },
  { start: 'Shoelace', target: 'Stoicism', optimal: 8 },
  { start: 'Toilet_paper', target: 'Renaissance_humanism', optimal: 8 },
  { start: 'Microwave_oven', target: 'Epistemology', optimal: 9 },
  { start: 'Umbrella', target: 'Paradox', optimal: 7 },
  { start: 'Stapler', target: 'Subconscious', optimal: 8 },

  // --- WEEK 4: Geography to Fiction ---
  { start: 'Madagascar', target: 'Cyberpunk', optimal: 7 },
  { start: 'Bermuda_Triangle', target: 'Middle-earth', optimal: 8 },
  { start: 'Mount_Fuji', target: 'Hogwarts', optimal: 7 },
  { start: 'Sahara', target: 'Darth_Vader', optimal: 8 },
  { start: 'Antarctica', target: 'Godzilla', optimal: 7 },
  { start: 'Amazon_rainforest', target: 'Batman', optimal: 7 },
  { start: 'Grand_Canyon', target: 'Pikachu', optimal: 8 },

  // --- WEEK 5: The "Wait, How?" Category ---
  { start: 'Doritos', target: 'Peloponnesian_War', optimal: 8 },
  { start: 'Minecraft', target: 'Philosophy_of_science', optimal: 7 },
  { start: 'Lego', target: 'Schizophrenia', optimal: 8 },
  { start: 'KFC', target: 'Isaac_Newton', optimal: 7 },
  { start: 'Red_Bull', target: 'Bronze_Age_collapse', optimal: 8 },
  { start: 'IKEA', target: 'Crusades', optimal: 7 },
  { start: 'Starbucks', target: 'Cold_War', optimal: 7 },

  // --- WEEK 6: Chaos Mode ---
  { start: 'Peppa_Pig', target: 'Oppenheimer_(film)', optimal: 7 },
  { start: 'Gordon_Ramsay', target: 'Nuclear_fission', optimal: 8 },
  { start: 'Doge_(meme)', target: 'Magna_Carta', optimal: 8 },
  { start: 'Shiba_Inu', target: 'French_Polynesia', optimal: 7 },
  { start: 'Rickrolling', target: 'Bermuda', optimal: 8 },
  { start: 'Breaking_Bad', target: 'Photosynthesis', optimal: 7 },
  { start: 'Among_Us', target: 'Industrial_Revolution', optimal: 8 },

  // --- WEEK 7: Mind Benders ---
  { start: 'Monopoly_(game)', target: 'Communism', optimal: 7 },
  { start: 'Skateboard', target: 'Gravity', optimal: 7 },
  { start: 'Rubber_duck', target: 'Artificial_intelligence', optimal: 8 },
  { start: 'Bubble_wrap', target: 'Psychology', optimal: 7 },
  { start: 'Ketchup', target: 'Roman_Empire', optimal: 7 },
  { start: 'Velcro', target: 'SpaceX', optimal: 8 },
  { start: 'Origami', target: 'DNA', optimal: 7 },

  // --- WEEK 8: Boss Fights (Good luck) ---
  { start: 'Snoop_Dogg', target: 'Calculus', optimal: 9 },
  { start: 'Hello_Kitty', target: 'Karl_Marx', optimal: 8 },
  { start: 'Taco_Bell', target: 'Albert_Einstein', optimal: 8 },
  { start: 'Sponge', target: 'Galaxies', optimal: 9 },
  { start: 'Hot_dog', target: 'Theory_of_relativity', optimal: 8 },
  { start: 'Banana', target: 'Internet_of_things', optimal: 8 },
  { start: 'Meme', target: 'Aristotle', optimal: 7 }
];

export const getDailyChallenge = () => {
  const today = new Date();
  
  // The day your game officially "Launches" Daily Mode
  const startDate = new Date('2026-03-30'); 
  
  // Calculate days passed since the start date (ignoring time zones/hours)
  const diffTime = today.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
  
  // If someone plays before the start date, default to Day 0
  const safeDays = Math.max(0, diffDays);
  
  // Loop back to the start of the list if we run out of days
  const pairIndex = safeDays % DAILY_PAIRS.length;
  
  return {
    dayNumber: safeDays + 1,
    pair: DAILY_PAIRS[pairIndex]
  };
};