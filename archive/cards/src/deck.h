#ifndef DECK_H_
#define DECK_H_

#include "card.h"
#include <vector>
#include <random>
#include <algorithm>

class deck
{
private:
    std::vector<card> m_cards;

public:
    deck(SDL_Renderer *renderer);
    void Shuffle();
    std::vector<card> get_hand(int num_player);
};

deck::deck(SDL_Renderer *renderer)
{
    for (int suit = Suit::HEARTS; suit <= Suit::SPADES; ++suit)
    {
        for (int rank = Rank::SEVEN; rank <= Rank::ACE; ++rank)
        {
            m_cards.push_back(card(static_cast<Rank>(rank), static_cast<Suit>(suit), renderer));
        }
    }
}

void deck::Shuffle()
{
    std::random_device rd;
    std::mt19937 g(rd());
    std::shuffle(m_cards.begin(), m_cards.end(), g);
}

std::vector<card> deck::get_hand(int num_player)
{
    int start_index = (num_player - 1) * 8;
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
    return hand;
}

#endif
