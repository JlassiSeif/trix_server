#ifndef GAME_H_
#define GAME_H_
#include "card.h"
#include "player.h"
#include "deck.h"
#include <vector>
#include <SDL.h>
class game
{

public:
    std::vector<card> table;
    std::vector<player> players;
    std::vector<SDL_Rect> og;
    std::vector<SDL_Rect> v_rects1;
    std::vector<SDL_Rect> v_rects2;
    std::vector<SDL_Rect> v_rects3;
    std::vector<SDL_Rect> v_rects4;
    std::vector<card> v_hand1;
    std::vector<card> v_hand2;
    std::vector<card> v_hand3;
    std::vector<card> v_hand4;
    int assigned_player = 1;
    SDL_Rect drop_place = {160, 150, 450, 250};
    int chosen_index;
    SDL_Renderer *renderer;
    deck m_deck = deck(renderer);
    int turn = 0;
    game(SDL_Renderer *&);
    void move_rect(int X, int Y);
    void render(SDL_Renderer *&renderer);
    bool check_mouse(int X, int Y);
    void drop_card(int X, int Y);
    void pli(int);
    void manche();
};

game::game(SDL_Renderer *&renderer)
{
    for (int i = 160; i < 600; i += 50)
    {
        SDL_Rect a = {i, 460, 79, 123};
        og.push_back(a);
    }

    for (int i = 160; i < 600; i += 50)
    {
        SDL_Rect a = {i, 460, 79, 123};
        v_rects1.push_back(a);
    }
    for (int i = 160; i < 600; i += 50)
    {
        SDL_Rect a = {i, 17, 79, 123};
        v_rects2.push_back(a);
    }
    for (int i = 60; i < 500; i += 50)
    {
        SDL_Rect a = {17, i, 79, 123};
        v_rects3.push_back(a);
    }
    for (int i = 60; i < 500; i += 50)
    {
        SDL_Rect a = {660, i, 79, 123};
        v_rects4.push_back(a);
    }
    players.push_back(player("lam3i"));
    players.push_back(player("mortadha"));
    players.push_back(player("3aksa"));
    players.push_back(player("khanfousa"));
    m_deck = deck(renderer);
    m_deck.Shuffle();
    v_hand1 = m_deck.get_hand(1);
    v_hand2 = m_deck.get_hand(2);
    v_hand3 = m_deck.get_hand(3);
    v_hand4 = m_deck.get_hand(4);
    players[0].reset_hand(v_hand1);
    players[1].reset_hand(v_hand2);
    players[2].reset_hand(v_hand3);
    players[3].reset_hand(v_hand4);
}
void game::render(SDL_Renderer *&renderer)
{
    for (int i = 0; i < v_hand1.size(); ++i)
    {
        v_hand1[i].render_card(renderer, v_rects1[i], 0);
    }
    for (int i = 0; i < v_hand2.size(); ++i)
    {
        v_hand2[i].render_card(renderer, v_rects2[i], 0);
    }

    for (int i = 0; i < v_hand3.size(); ++i)
    {
        v_hand3[i].render_card(renderer, v_rects3[i], 90);
    }
    for (int i = 0; i < v_hand4.size(); ++i)
    {
        v_hand4[i].render_card(renderer, v_rects4[i], 90);
    }
    SDL_SetRenderDrawColor(renderer, 255, 255, 255, 255);
    SDL_RenderDrawRect(renderer, &drop_place);
}
int decide_mekla(const std::vector<card> table)
{
    Suit strong_suit = table[0].c_suit;
    int max_value = table[0].c_rank;
    size_t max_index = 0;
    for (size_t i = 1; i < table.size(); ++i)
    {
        const auto &card = table[i];
        if (card.c_suit == strong_suit && card.c_rank > max_value)
        {
            max_value = card.c_rank;
            max_index = i;
        }
    }

    return max_index;
}
bool game::check_mouse(int X, int Y)
{
    for (int i = 0; i < v_rects1.size(); ++i)
    {
        SDL_Point a = {X, Y};
        if (SDL_PointInRect(&a, &v_rects1[i]))
        {
            chosen_index = i;
            return 1;
        }
    }
    return 0;
}
void game::drop_card(int X, int Y)
{
    SDL_Point a = {X, Y};
    if (SDL_PointInRect(&a, &drop_place))
    {
        v_rects1[chosen_index].x = 340;
        v_rects1[chosen_index].y = 280;
        table.push_back(v_hand1[chosen_index]);
    }
    else
    {
        v_rects1[chosen_index].x = og[chosen_index].x;
        v_rects1[chosen_index].y = og[chosen_index].y;
    }
}

void game::move_rect(int X, int Y)
{
    v_rects1[chosen_index].x = X - v_rects1[chosen_index].w / 2;
    v_rects1[chosen_index].y = Y - v_rects1[chosen_index].h / 2;
}
void game::manche()
{
    // TODO: chose game
    int starter = 1;
    m_deck.Shuffle();
    v_hand1 = m_deck.get_hand(1);
    v_hand2 = m_deck.get_hand(2);
    v_hand3 = m_deck.get_hand(3);
    v_hand4 = m_deck.get_hand(4);
    players[0].reset_hand(v_hand1);
    players[1].reset_hand(v_hand2);
    players[2].reset_hand(v_hand3);
    players[3].reset_hand(v_hand4);
    for (int i = 0; i < 8; ++i)
    {
        pli(starter);
    }
}
void game::pli(int starter)
{

    for (auto i : {1, 2, 3, 4})

    {
        if ((starter + i) % 4 != assigned_player)
        {
        }
        // card c = players[(starter + i - 1) % 4].play();
        // table.push_back(c);
    }
    int p = decide_mekla(table);
    players[p].add_mekla(table);
}

#endif