#ifndef CARD_H_
#define CARD_H_
#include <string>
#include <iostream>
#include <SDL.h>

enum Suit
{
    HEARTS,
    CLUBS,
    DIAMONDS,
    SPADES
};
enum Rank
{
    SEVEN,
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
    card(Rank, Suit, SDL_Renderer *&);
    void render_card(SDL_Renderer *&, SDL_Rect, double angle);
    std::string get_name();
    Suit c_suit;
    Rank c_rank;
    std::string designation;
    SDL_Texture *texture;
};
card::card(Rank rank, Suit suit, SDL_Renderer *&renderer)
{
    c_rank = rank;
    c_suit = suit;
    designation = get_name();
    std::string path = "assets/cards/" + designation + ".bmp";
    SDL_Surface *surface = SDL_LoadBMP(path.c_str());
    texture = SDL_CreateTextureFromSurface(renderer, surface);
    SDL_FreeSurface(surface);
}

void card::render_card(SDL_Renderer *&renderer, SDL_Rect rect, double angle)
{
    SDL_RenderCopyEx(renderer, texture, NULL, &rect, angle, NULL, SDL_FLIP_NONE);
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