#ifndef CARD_HPP_
#define CARD_HPP_
#include <string>
#include <iostream>

enum Suit
{
    HEARTS,
    CLUBS,
    DIAMONDS,
    SPADES
};
enum Rank
{
    SEVEN = 0,
    EIGHT,
    NINE,
    JACK,
    QUEEN,
    KING,
    TEN,
    ACE,
};

class card
{
public:
    card(Rank, Suit);
    std::string get_name();
    Suit c_suit;
    Rank c_rank;
    std::string designation;
};
card::card(Rank rank, Suit suit)
{
    c_rank = rank;
    c_suit = suit;
    designation = get_name();
}

std::string card::get_name()
{
    std::string rankString;
    switch (c_rank)
    {
    case ACE:
        rankString = "a";
        break;
    case JACK:
        rankString = "j";
        break;
    case QUEEN:
        rankString = "q";
        break;
    case KING:
        rankString = "k";
        break;
    case SEVEN:
        rankString = "7";
        break;
    case EIGHT:
        rankString = "8";
        break;
    case NINE:
        rankString = "9";
        break;
    case TEN:
        rankString = "10";
        break;
    default:
        rankString = std::to_string(c_rank);
        break;
    }

    std::string suitString;
    switch (c_suit)
    {
    case HEARTS:
        suitString = "h";
        break;
    case DIAMONDS:
        suitString = "d";
        break;
    case CLUBS:
        suitString = "c";
        break;
    case SPADES:
        suitString = "s";
        break;
    }
    std::string designation = rankString + "_" + suitString;
    return designation;
}
#endif