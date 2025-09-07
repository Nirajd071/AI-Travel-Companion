"""
Fallback response system for AI Travel Companion
Provides intelligent responses when OpenAI API is unavailable
"""

def generate_fallback_response(message: str) -> str:
    """Generate intelligent fallback responses based on user input"""
    message_lower = message.lower()
    
    if any(word in message_lower for word in ["hello", "hi", "hey", "start"]):
        return """Hello! I'm your AI Travel Companion. While I'm currently running in offline mode, I can still help you with travel planning! 

I can assist with:
🌍 Destination recommendations
🗺️ Itinerary planning
🍽️ Restaurant suggestions
🏨 Accommodation advice
💰 Budget planning
🎯 Activity recommendations

What would you like to explore today?"""

    elif any(word in message_lower for word in ["paris", "france"]):
        return """Paris is absolutely magical! Here are my top recommendations:

🗼 **Must-See Attractions:**
- Eiffel Tower (best views from Trocadéro)
- Louvre Museum (book skip-the-line tickets)
- Notre-Dame Cathedral area
- Montmartre & Sacré-Cœur

🍽️ **Food Experiences:**
- Croissants at Du Pain et des Idées
- Dinner cruise on the Seine
- Local bistros in Le Marais
- Macarons at Ladurée

💡 **Pro Tips:**
- Visit major attractions early morning or late afternoon
- Use the Metro day pass for easy transport
- Try local markets like Marché Saint-Germain

Would you like specific recommendations for activities, restaurants, or a day-by-day itinerary?"""

    elif any(word in message_lower for word in ["tokyo", "japan"]):
        return """Tokyo is incredible! Here's what you shouldn't miss:

🏯 **Cultural Highlights:**
- Senso-ji Temple (Asakusa district)
- Meiji Shrine (peaceful oasis)
- Imperial Palace East Gardens
- Traditional neighborhoods like Yanaka

🍜 **Food Adventures:**
- Tsukiji Outer Market for fresh sushi
- Ramen in Shibuya or Shinjuku
- Izakayas in Golden Gai
- Conveyor belt sushi experience

🛍️ **Unique Experiences:**
- Shibuya Crossing at rush hour
- Robot Restaurant show
- Harajuku street fashion
- Onsen (hot springs) experience

🚇 **Getting Around:**
- JR Pass for unlimited train travel
- Download Google Translate app
- IC card for local transport

What aspect of Tokyo interests you most?"""

    elif any(word in message_lower for word in ["budget", "cheap", "affordable"]):
        return """Smart budget travel tips! Here are proven strategies:

💰 **Top Budget Destinations:**
- Southeast Asia: Thailand, Vietnam ($20-30/day)
- Eastern Europe: Prague, Budapest ($30-40/day)
- Central America: Guatemala, Nicaragua ($25-35/day)
- India: Incredible value ($15-25/day)

🏠 **Accommodation Savings:**
- Hostels with good reviews
- Airbnb for longer stays
- House-sitting opportunities
- Couchsurfing for cultural exchange

✈️ **Flight Deals:**
- Use flexible date searches
- Book Tuesday-Thursday departures
- Consider budget airlines for short distances
- Set price alerts on Google Flights

🍽️ **Food Budget Tips:**
- Street food and local markets
- Cook some meals if possible
- Lunch specials vs dinner prices
- Local grocery stores for snacks

Would you like specific budget breakdowns for any destination?"""

    elif any(word in message_lower for word in ["restaurant", "food", "eat", "dining"]):
        return """Great food makes any trip memorable! Here's how to find the best:

🔍 **Finding Great Restaurants:**
- Ask locals for recommendations
- Look for places busy with locals
- Check recent reviews on Google Maps
- Avoid tourist-heavy areas for authentic cuisine

🍽️ **Types to Try:**
- Street food for authentic flavors
- Local markets for fresh ingredients
- Family-run establishments
- Regional specialties unique to the area

💡 **Pro Tips:**
- Learn basic food phrases in local language
- Be adventurous but know your dietary restrictions
- Try lunch specials for better value
- Make reservations for popular spots

📱 **Useful Apps:**
- Google Translate for menus
- TripAdvisor for reviews
- Local food delivery apps to see popular dishes

What type of cuisine or dining experience are you looking for?"""

    elif any(word in message_lower for word in ["itinerary", "plan", "schedule", "days"]):
        return """Perfect! Let me help you create an amazing itinerary:

📅 **Planning Framework:**
- Day 1: Arrival + nearby exploration
- Day 2-3: Major attractions
- Day 4+: Local experiences + hidden gems
- Last day: Shopping + departure prep

⏰ **Daily Structure:**
- Morning: Major sights (less crowded)
- Afternoon: Museums or indoor activities
- Evening: Dining + entertainment

🎯 **Balance is Key:**
- Mix must-sees with spontaneous exploration
- Include rest time and meal breaks
- Plan for weather contingencies
- Leave room for unexpected discoveries

📍 **Location Clustering:**
- Group nearby attractions together
- Consider transport time between locations
- Plan routes to minimize backtracking

To create a personalized itinerary, I'd need to know:
- Which city/destination?
- How many days?
- Your interests (culture, food, adventure, etc.)
- Budget range?"""

    elif any(word in message_lower for word in ["weather", "climate", "season"]):
        return """Weather planning is crucial for a great trip! Here's what to consider:

🌤️ **Seasonal Planning:**
- Spring: Mild weather, blooming flowers, fewer crowds
- Summer: Peak season, warm weather, higher prices
- Fall: Great weather, beautiful colors, good deals
- Winter: Lower prices, unique experiences, pack warm

🌍 **Regional Considerations:**
- Tropical: Dry vs rainy seasons
- Mediterranean: Hot summers, mild winters
- Northern climates: Extreme seasonal variations
- Monsoon regions: Plan around wet seasons

🎒 **Packing Smart:**
- Check 10-day forecast before departure
- Layer clothing for temperature changes
- Waterproof gear for rainy destinations
- Sun protection for tropical locations

📱 **Weather Apps:**
- Local weather services for accuracy
- Check UV index for outdoor activities
- Monitor severe weather alerts

Which destination and time of year are you considering?"""

    else:
        return f"""I understand you're asking about: "{message}"

While I'm currently in offline mode, I'm still here to help with your travel planning! I can provide detailed advice on:

🌍 **Destinations:** Recommendations based on your interests and budget
🗓️ **Planning:** Itineraries, timing, and logistics
🍽️ **Local Experiences:** Food, culture, and hidden gems
💰 **Budget Tips:** How to maximize your travel budget
🎯 **Activities:** Adventures tailored to your travel style

Could you be more specific about what aspect of travel you'd like help with? For example:
- "Plan a 5-day trip to Italy"
- "Budget backpacking in Southeast Asia"
- "Best restaurants in Barcelona"
- "What to pack for Iceland in winter"

The more details you provide, the better I can assist you!"""

def generate_suggestions(message: str) -> list:
    """Generate contextual follow-up suggestions"""
    message_lower = message.lower()
    
    if "paris" in message_lower:
        return [
            "Best time to visit Paris?",
            "Paris museum recommendations",
            "Romantic spots in Paris",
            "Paris food tour suggestions"
        ]
    elif "tokyo" in message_lower:
        return [
            "Tokyo neighborhoods to explore",
            "Japanese etiquette tips",
            "Best Tokyo food experiences",
            "Day trips from Tokyo"
        ]
    elif "budget" in message_lower:
        return [
            "Cheapest destinations in Europe",
            "Budget accommodation tips",
            "Free activities worldwide",
            "How to save on flights"
        ]
    elif "food" in message_lower or "restaurant" in message_lower:
        return [
            "Local food markets to visit",
            "Street food safety tips",
            "Vegetarian options abroad",
            "Food allergy translations"
        ]
    elif "itinerary" in message_lower:
        return [
            "How many days do I need?",
            "Must-see vs hidden gems",
            "Transportation between cities",
            "Booking accommodations"
        ]
    else:
        return [
            "Plan a weekend getaway",
            "Find budget-friendly destinations",
            "Suggest adventure activities",
            "Help with travel logistics"
        ]
