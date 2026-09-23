#ifndef DECK_HPP_
#define DECK_HPP_

#include "card.hpp"
#include <vector>
#include <random>
#include <algorithm>
#include <map>

class deck
{
private:
    std::vector<card> m_cards;
    std::map<std::string, card> card_map;

public:
    deck();
    void Shuffle();
    int decide_mekla(const std::vector<std::string> table);
    std::string get_hand(int num_player);
    std::vector<card> string_to_cards(std::vector<std::string> e);
};

deck::deck()
{
    for (int suit = Suit::HEARTS; suit <= Suit::SPADES; ++suit)
    {
        for (int rank = Rank::SEVEN; rank <= Rank::ACE; ++rank)
        {
            card car = card(static_cast<Rank>(rank), static_cast<Suit>(suit));
            m_cards.push_back(car);
            card_map.emplace(car.designation, car);
        }
    }
}

void deck::Shuffle()
{
    std::random_device rd;
    std::mt19937 g(rd());
    std::shuffle(m_cards.begin(), m_cards.end(), g);
}
std::string hand_to_string(std::vector<card> hand)
{
    std::string cards_string = "";
    for (int i = 0; i < hand.size(); i++)
    {
        cards_string += hand[i].designation;
        if (i < hand.size() - 1)
        {
            cards_string += ";";
        }
    }
    return cards_string;
}
std::vector<card> deck::string_to_cards(std::vector<std::string> e)
{
    std::vector<card> p;
    for (auto el : e)
    {
        p.push_back(card_map.at(el));
    }
    return p;
}
int deck::decide_mekla(std::vector<std::string> klash)
{
    if (klash.empty())
    {
        // Handle the case where the input vector is empty
        return -1; // Or some other value indicating that no card can win the trick
    }

    std::vector<card> table = string_to_cards(klash);

    Suit strong_suit = table[0].c_suit;
    int max_value = Rank::SEVEN; // Initialize to minimum rank
    size_t max_index = 0;
    for (size_t i = 0; i < table.size(); ++i) // Start loop from 0
    {
        if (table[i].c_suit == strong_suit)
        {
            if (table[i].c_rank > max_value)
            {
                max_value = table[i].c_rank;
                max_index = i;
            }
        }
    }

    return max_index;
}

std::string deck::get_hand(int num_player)
{
    int start_index = (num_player)*8;
    int end_index = start_index + 8;
    std::vector<card> hand;
    hand.reserve(8);
    std::copy(m_cards.begin() + start_index, m_cards.begin() + end_index, std::back_inserter(hand));
    std::sort(hand.begin(), hand.end(), [](const card &c1, const card &c2)
              {
        if (c1.c_suit == c2.c_suit) {
            return c1.c_rank > c2.c_rank;
        }
        return c1.c_suit < c2.c_suit; });
    std::string hand_str = hand_to_string(hand);
    return hand_str;
}

#endif
