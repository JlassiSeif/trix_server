#ifndef PLAYER_H_
#define PLAYER_H_
#include "card.h"
#include <vector>
#include <string>
#include <iostream>
class player
{
private:
    std::vector<card> hand;
    std::vector<card> p_mekla;
    std::string p_name;
    int score = 0;

public:
    player(std::string);
    void reset_hand(std::vector<card>);
    void add_score(int);
    void reset_mekla();
    void add_mekla(std::vector<card>);
    card play_card(int);
    card play();
};

player::player(std::string name)
{
    p_name = name;
}
void player::reset_hand(std::vector<card> dealt_hand)
{
    hand = dealt_hand;
}

void player::add_score(int value)
{
    score += value;
}
void player::reset_mekla()
{
    p_mekla.clear();
}
void player::add_mekla(std::vector<card> mekla)
{
    p_mekla.insert(p_mekla.end(), mekla.begin(), mekla.end());
}
card player::play_card(int chosen)
{
    card a = hand[chosen];
    hand.erase(hand.begin() + chosen);
    return a;
}
#endif