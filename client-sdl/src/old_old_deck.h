#ifndef DECK_H_
#define DECK_H_

#include "card.h"
#include <vector>
#include <random>
#include <algorithm>
#include <string>
#include <sstream>
#include <map>

class deck
{
public:
    // Constructor that populates card_map with all cards in the deck
    deck(SDL_Renderer *renderer);
    deck();

    // Returns a hand of specified number of cards randomly selected from the deck
    std::vector<card> get_hand(int num_player);
    void render_card(SDL_Renderer *&renderer, SDL_Rect rect, double angle, std::string &desig);
    // Returns a vector of cards parsed from the input string
    // Input string format should be comma-separated values of card designations (e.g. "7_1,10_2,12_3")
    // Throws an exception if input string is empty or has invalid format
    std::vector<card> get_hand_from_str(const std::string &input);
    Suit get_suit(std::string);

private:
    // Map that stores all cards in the deck
    std::map<std::string, card> card_map;
};
deck::deck()
{
    // Initialize an empty card_map
    card_map = std::map<std::string, card>();
}

Suit deck::get_suit(std::string m_suit)
{
    Suit hell = card_map.at(m_suit).c_suit;
    return hell;
}

deck::deck(SDL_Renderer *renderer)
{
    // Populate card_map with all cards in the deck
    for (int suit = Suit::HEARTS; suit <= Suit::SPADES; ++suit)
    {
        for (int rank = Rank::SEVEN; rank <= Rank::ACE; ++rank)
        {
            // std::string one = std::to_string(rank);
            // std::string two = std::to_string(suit);
            // std::string a = one + "_" + two;
            card car = card(static_cast<Rank>(rank), static_cast<Suit>(suit), renderer);
            card_map.emplace(car.designation, car);
        }
    }
}

std::vector<std::string> splitString(const std::string &input, char karak)
{
    // Split input string into a vector of substrings using ',' as the delimiter
    std::vector<std::string> result;
    std::stringstream ss(input);
    std::string token;
    while (std::getline(ss, token, karak))
    {
        result.push_back(token);
    }
    // Throw an exception if input string is empty or has invalid format
    if (result.empty() || result.size() > 13) // maximum number of cards in a hand is 13
    {
        throw std::invalid_argument("Invalid input string format.");
    }
    return result;
}
void deck::render_card(SDL_Renderer *&renderer, SDL_Rect rect, double angle, std::string &desig)
{
    card hell = card_map.at(desig);
    hell.render_card(renderer, rect, 0);
}

std::vector<card> deck::get_hand_from_str(const std::string &input)
{
    // Parse input string into a vector of cards
    std::vector<card> hand;
    std::vector<std::string> tokens;
    try
    {
        tokens = splitString(input, ';');
    }
    catch (const std::exception &e)
    {
        std::cerr << e.what() << std::endl;
        return hand;
    }
    for (auto &token : tokens)
    {
        try
        {
            hand.push_back(card_map.at(token));
        }
        catch (const std::out_of_range &e)
        {
            std::cerr << "Invalid card designation: " << token << std::endl;
        }
    }
    std::sort(hand.begin(), hand.end(), [](const card &c1, const card &c2)
              {
                  if (c1.c_suit == c2.c_suit)
                  {
                      return c1.c_rank > c2.c_rank;
                  }
                  return c1.c_suit < c2.c_suit; });
    return hand;
}

#endif
