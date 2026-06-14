// ──────────────────────────────────────────────────────────────
// Customer Data Generator
// Generates realistic Indian customer profiles for StyleNova
// ──────────────────────────────────────────────────────────────

export interface GeneratedCustomer {
  name: string
  email: string
  phone: string
  city: string
  state: string
  country: string
  age: number
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  source: 'ORGANIC' | 'REFERRAL' | 'PAID_AD' | 'SOCIAL_MEDIA'
}

// ─── Name Data ───────────────────────────────────────────────

const maleFirstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun',
  'Reyansh', 'Mohammed', 'Sai', 'Arnav', 'Dhruv',
  'Kabir', 'Ritvik', 'Anirudh', 'Shaurya', 'Atharv',
  'Advait', 'Ishaan', 'Rohan', 'Kunal', 'Varun',
  'Rishi', 'Kartik', 'Ayush', 'Pranav', 'Nikhil',
  'Harsh', 'Yash', 'Dev', 'Rahul', 'Amit',
  'Siddharth', 'Akash', 'Manish', 'Vikram', 'Suresh',
  'Karan', 'Abhinav', 'Gaurav', 'Sachin', 'Rajat',
  'Deepak', 'Arun', 'Prateek', 'Neeraj', 'Sahil',
  'Tushar', 'Anand', 'Vishal', 'Tarun', 'Mohit',
]

const femaleFirstNames = [
  'Aanya', 'Saanvi', 'Myra', 'Ananya', 'Aadhya',
  'Aaradhya', 'Prisha', 'Navya', 'Pari', 'Diya',
  'Aditi', 'Kiara', 'Riya', 'Isha', 'Kavya',
  'Shreya', 'Mira', 'Pooja', 'Neha', 'Priya',
  'Tanvi', 'Sanya', 'Aisha', 'Zara', 'Nisha',
  'Meera', 'Divya', 'Anjali', 'Sneha', 'Komal',
  'Swati', 'Deepika', 'Pallavi', 'Rashmi', 'Shalini',
  'Bhavna', 'Kritika', 'Megha', 'Ruhi', 'Simran',
  'Jyoti', 'Sakshi', 'Mansi', 'Nikita', 'Ritu',
  'Aparna', 'Chitra', 'Garima', 'Lavanya', 'Vrinda',
]

const lastNames = [
  'Sharma', 'Verma', 'Patel', 'Gupta', 'Singh',
  'Kumar', 'Mehta', 'Shah', 'Joshi', 'Reddy',
  'Nair', 'Iyer', 'Menon', 'Das', 'Chatterjee',
  'Banerjee', 'Pillai', 'Rao', 'Desai', 'Kulkarni',
  'Kapoor', 'Malhotra', 'Bhatia', 'Agarwal', 'Saxena',
  'Mishra', 'Pandey', 'Tiwari', 'Chauhan', 'Yadav',
  'Jain', 'Sinha', 'Mukherjee', 'Bhatt', 'Chopra',
  'Kaur', 'Gill', 'Bose', 'Sen', 'Patil',
  'Thakur', 'Dubey', 'Srivastava', 'Choudhary', 'Dutta',
  'Rathore', 'Goswami', 'Naidu', 'Hegde', 'Sethi',
]

// ─── City Data ───────────────────────────────────────────────

const cities: Array<{ city: string; state: string }> = [
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Delhi', state: 'Delhi' },
  { city: 'Bangalore', state: 'Karnataka' },
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'Lucknow', state: 'Uttar Pradesh' },
  { city: 'Chandigarh', state: 'Punjab' },
  { city: 'Kochi', state: 'Kerala' },
  { city: 'Indore', state: 'Madhya Pradesh' },
  { city: 'Guwahati', state: 'Assam' },
  { city: 'Bhopal', state: 'Madhya Pradesh' },
]

// ─── Helpers ─────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const emailDomains = ['gmail.com', 'yahoo.co.in', 'outlook.com', 'gmail.com', 'gmail.com']
// gmail weighted higher ↑

function generatePhone(): string {
  // +91 followed by a digit 6-9, then 9 random digits
  const firstDigit = randomItem([6, 7, 8, 9])
  let number = `${firstDigit}`
  for (let i = 0; i < 9; i++) {
    number += Math.floor(Math.random() * 10)
  }
  return `+91${number}`
}

function generateAge(): number {
  // Bell curve-ish around 28-35 with outliers
  const r = Math.random()
  if (r < 0.05) return randomInt(18, 21) // 5% young
  if (r < 0.20) return randomInt(22, 25) // 15%
  if (r < 0.50) return randomInt(26, 32) // 30% core
  if (r < 0.80) return randomInt(33, 40) // 30%
  if (r < 0.95) return randomInt(41, 50) // 15%
  return randomInt(51, 65)               // 5% older
}

function generateSource(): GeneratedCustomer['source'] {
  const r = Math.random()
  if (r < 0.40) return 'ORGANIC'       // 40%
  if (r < 0.65) return 'SOCIAL_MEDIA'  // 25%
  if (r < 0.85) return 'REFERRAL'      // 20%
  return 'PAID_AD'                      // 15%
}

// ─── Main Generator ─────────────────────────────────────────

/**
 * Generate realistic Indian customer profiles.
 *
 * @param count Number of customers to generate
 * @returns Array of customer data objects
 */
export function generateCustomers(count: number): GeneratedCustomer[] {
  const usedEmails = new Set<string>()
  const customers: GeneratedCustomer[] = []

  for (let i = 0; i < count; i++) {
    // Gender distribution: ~50% female, ~45% male, ~5% other
    const genderRoll = Math.random()
    let gender: GeneratedCustomer['gender']
    let firstName: string

    if (genderRoll < 0.50) {
      gender = 'FEMALE'
      firstName = randomItem(femaleFirstNames)
    } else if (genderRoll < 0.95) {
      gender = 'MALE'
      firstName = randomItem(maleFirstNames)
    } else {
      gender = 'OTHER'
      firstName = randomItem([...maleFirstNames, ...femaleFirstNames])
    }

    const lastName = randomItem(lastNames)
    const location = randomItem(cities)

    // Generate unique email
    let email: string
    let attempts = 0
    do {
      const domain = randomItem(emailDomains)
      const separator = randomItem(['.', '_', ''])
      const suffix = attempts > 0 ? `${randomInt(1, 999)}` : ''
      email = `${firstName.toLowerCase()}${separator}${lastName.toLowerCase()}${suffix}@${domain}`
      attempts++
    } while (usedEmails.has(email) && attempts < 20)

    usedEmails.add(email)

    customers.push({
      name: `${firstName} ${lastName}`,
      email,
      phone: generatePhone(),
      city: location.city,
      state: location.state,
      country: 'India',
      age: generateAge(),
      gender,
      source: generateSource(),
    })
  }

  return customers
}
