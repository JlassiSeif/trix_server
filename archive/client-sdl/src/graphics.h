#ifndef GRAPHICS_H_
#define GRAPHICS_H_

#include <SDL.h>
#include <vector>
#include <string>
#include "card.h"
#include "old_old_deck.h"

class graphics
{
private:
    const int kWindowWidth = 800;
    const int kWindowHeight = 600;
    const int kCardWidth = 79;
    const int kCardHeight = 123;
    const int kCardSpacing = 50;
    const int kCardBackAngle = 0;

public:
    SDL_Window *window;
    SDL_Renderer *renderer;
    bool running;
    SDL_bool isDragging;
    bool is_choosing = 0;
    int turn_index = -1;
    bool other_player_choosing = 0;
    bool choice_of_card_is_made = 0;
    bool my_turn = 0;
    bool bool_render_previous_cards = 0;
    std::vector<std::string> games;
    std::map<std::string, int> scores;
    SDL_Rect card1 = {571, 389, 39, 61};
    SDL_Rect card2 = {532, 389, 39, 61};
    SDL_Rect card3 = {493, 389, 39, 61};
    SDL_Rect card4 = {454, 389, 39, 61};
    std::vector<SDL_Rect> previous_cards = {card1, card2, card3, card4};
    std::map<std::string, SDL_Rect> source_rects;
    SDL_Rect target_rect = {530, 150, 80, 75};
    std::string chosen_game = "damet";
    std::string pre_cards_to_render[4];
    std::vector<SDL_Rect> og;
    std::vector<SDL_Rect> v_rects1;
    std::vector<SDL_Rect> choosing_rects;
    std::vector<SDL_Rect> inv_rects2;
    std::vector<SDL_Rect> inv_rects3;
    std::vector<SDL_Rect> inv_rects4;
    std::vector<SDL_Rect> turns;
    std::vector<card> v_hand1;
    int m_client_fd = -1;
    std::string played_card[4] = {""};
    bool cards_array[8] = {1, 1, 1, 1, 1, 1, 1, 1};
    bool cards_to_render[8] = {1, 1, 1, 1, 1, 1, 1, 1};
    bool available_games[7] = {1, 1, 1, 1, 1, 1, 1};
    bool movable_cards[8] = {1, 1, 1, 1, 1, 1, 1, 1};
    SDL_Rect drop_place = {160, 150, 450, 300};
    SDL_Rect choices_rect = {0, 0, 800, 300};
    SDL_Rect cards_places[3] = {
        {280, 225, kCardWidth, kCardHeight},
        {340, 160, kCardWidth, kCardHeight},
        {399, 225, kCardWidth, kCardHeight}};
    long signed int chosen_index = -1;
    SDL_Texture *back_texture;
    SDL_Texture *choices_texture;
    SDL_Texture *nope_texture;
    deck m_deck = deck();
    int my_index = -1;
    bool suit_decided = 0;
    std::vector<std::string>
        played_kwaret;
    graphics(int, std::string, int);
    void close();
    void render();
    void render_choices(bool);
    bool run();
    bool check_mouse(int X, int Y, std::vector<SDL_Rect> &rects);
    void drop_card(int X, int Y);
    void move_rect(int X, int Y, SDL_Rect &selected_rect);
    void wait();
    void render_cards();
    void update();
    void reset_variables();
    void render_played_card(int index, std::string cad);
    std::string parse(std::string message);
    void render_card_back(SDL_Renderer *&renderer, SDL_Rect rect, double angle);
    std::string response = "";
    Suit strong_suit;
    SDL_Texture *
    loadTexture(const std::string &path);
};
SDL_Texture *graphics::loadTexture(const std::string &path)
{
    SDL_Surface *surface = SDL_LoadBMP(path.c_str());
    SDL_Texture *texture = SDL_CreateTextureFromSurface(renderer, surface);
    SDL_FreeSurface(surface);
    return texture;
}

graphics::graphics(int client_fd, std::string instance_name, int m_index)
{
    // Initialize SDL
    SDL_Init(SDL_INIT_VIDEO);
    window = SDL_CreateWindow(instance_name.c_str(), SDL_WINDOWPOS_CENTERED, SDL_WINDOWPOS_CENTERED, kWindowWidth, kWindowHeight, 0);
    renderer = SDL_CreateRenderer(window, -1, 0);
    running = true;
    isDragging = SDL_FALSE;
    m_client_fd = client_fd;
    my_index = m_index;
    // Load back texture
    back_texture = loadTexture("assets/cards/back.bmp");
    choices_texture = loadTexture("assets/lo3ab.bmp");
    nope_texture = loadTexture("assets/nope.bmp");
    SDL_Rect left = {110, 285, 30, 30};
    SDL_Rect right = {620, 285, 30, 30};
    SDL_Rect top = {375, 160, 30, 30};
    turns = {left, top, right};
    std::string gamesArr[] = {"damet", "ray", "dineri", "pli", "farcha", "trix", "general"};
    games.assign(std::begin(gamesArr), std::end(gamesArr));
    // Initialize rectangles
    for (int i = 160; i < 600; i += 50)
    {
        SDL_Rect rect{i, 460, 79, 123};
        og.push_back(rect);
        v_rects1.push_back(rect);
        inv_rects2.push_back(SDL_Rect{i, 17, 79, 123});
    }

    for (int i = 60; i < 500; i += 50)
    {
        inv_rects3.push_back(SDL_Rect{17, i, 79, 123});
        inv_rects4.push_back(SDL_Rect{660, i, 79, 123});
    }
    for (int i = 0; i < 800; i += 160)
    {
        choosing_rects.push_back(SDL_Rect{i, 0, 160, 150});
    }
    choosing_rects.push_back(SDL_Rect{240, 150, 160, 150});
    choosing_rects.push_back(SDL_Rect{400, 150, 160, 150});
    // Initialize deck and hand
    m_deck = deck(renderer);
    std::string handd = "7_c;7_d;7_h;7_s;8_c;8_d;8_h;8_s";
    v_hand1 = m_deck.get_hand_from_str(handd);

    source_rects["damet"] = {0, 0, 162, 152};
    source_rects["ray"] = {162, 0, 160, 150};
    source_rects["dineri"] = {322, 0, 160, 152};
    source_rects["pli"] = {482, 0, 160, 152};
    source_rects["farcha"] = {640, 0, 160, 152};
    source_rects["trix"] = {240, 150, 162, 154};
    source_rects["general"] = {400, 150, 160, 152};
}
void graphics::render_card_back(SDL_Renderer *&renderer, SDL_Rect rect, double angle)
{
    SDL_RenderCopyEx(renderer, back_texture, NULL, &rect, angle, NULL, SDL_FLIP_NONE);
}

void graphics::render_cards()
{ // Render drop place rectangle
    SDL_SetRenderDrawColor(renderer, 255, 255, 255, 255);
    SDL_RenderDrawRect(renderer, &drop_place);
    SDL_RenderCopyEx(renderer, choices_texture, &source_rects[chosen_game], &target_rect, 0, NULL, SDL_FLIP_NONE);
    for (int i = 0; i < 4; ++i)
    {
        if (!(played_card[i] == ""))
        {
            render_played_card(i, played_card[i]);
        }
    }
    // render graphics
    for (int i = 0; i < 8; ++i)
    {
        if (cards_to_render[i])
        {
            v_hand1[i].render_card(renderer, v_rects1[i], 0);
        }
    }
    for (int i = 0; i < 8; ++i)
    {
        if (cards_array[i])
        {
            render_card_back(renderer, inv_rects2[i], 0);
        }
    }
    for (int i = 0; i < 8; ++i)
    {
        if (cards_array[i])
        {
            render_card_back(renderer, inv_rects3[i], 0);
        }
    }
    for (int i = 0; i < 8; ++i)
    {
        if (cards_array[i])
        {
            render_card_back(renderer, inv_rects4[i], 0);
        }
    }
    if (bool_render_previous_cards)
    {
        for (int i = 0; i < 4; ++i)
        {
            SDL_Rect rect = previous_cards[i];
            m_deck.render_card(renderer, rect, 0, pre_cards_to_render[i]);
        }
    }
}
void graphics::render_choices(bool other)
{

    // render graphics
    if (!other)
    {
        SDL_RenderCopyEx(renderer, choices_texture, NULL, &choices_rect, 0, NULL, SDL_FLIP_NONE);
        for (int i = 0; i < 7; ++i)
        {
            if (!available_games[i])
            {
                SDL_Rect p = choosing_rects[i];
                SDL_RenderCopyEx(renderer, nope_texture, NULL, &p, 0, NULL, SDL_FLIP_NONE);
            }
        }
    }
    std::for_each(v_hand1.begin(), v_hand1.end(), [this](auto &card)
                  {
        const long unsigned int i = &card - &v_hand1[0];
        card.render_card(renderer, v_rects1[i], 0); });
}
void graphics::render_played_card(int index, std::string cad)
{

    SDL_Rect rect = cards_places[index];
    m_deck.render_card(renderer, rect, 0, cad);
}

void graphics::render()
{
    // Clear screen
    SDL_SetRenderDrawColor(renderer, 0, 64, 64, 255);
    SDL_RenderClear(renderer);
    // render
    SDL_Rect bottom = {375, 405, 30, 30};
    if (my_turn)
    {
        SDL_RenderCopyEx(renderer, nope_texture, NULL, &bottom, 0, NULL, SDL_FLIP_NONE);
    }
    if (turn_index >= 0)
    {
        SDL_RenderCopyEx(renderer, nope_texture, NULL, &turns[turn_index], 0, NULL, SDL_FLIP_NONE);
    }
    if (is_choosing || other_player_choosing)
    {
        render_choices(other_player_choosing);
    }

    else
    {
        render_cards();
    }
    // Update screen
    SDL_RenderPresent(renderer);
}
bool graphics::run()
{
    SDL_Event event;
    while (SDL_PollEvent(&event))
    {
        switch (event.type)
        {
        case SDL_QUIT:
            close();
            return 0;
        case SDL_MOUSEBUTTONDOWN:
            if (event.button.button == SDL_BUTTON_LEFT)
            {
                if (is_choosing)
                {
                    if (check_mouse(event.button.x, event.button.y, choosing_rects))
                    {
                        if (available_games[chosen_index])
                        {
                            available_games[chosen_index] = 0;
                            is_choosing = 0;
                            std::string chosen_game = games[chosen_index];
                            send(m_client_fd, chosen_game.c_str(), strlen(chosen_game.c_str()), 0);
                        }
                    }
                    else
                    {
                        chosen_index = -1;
                    }
                }
                else if (check_mouse(event.button.x, event.button.y, v_rects1))
                {
                    isDragging = SDL_TRUE;
                }
            }
            break;
        case SDL_MOUSEBUTTONUP:

            if (!is_choosing)
            {
                if (isDragging)
                {
                    if (event.button.button == SDL_BUTTON_LEFT)
                    {
                        drop_card(event.button.x, event.button.y);
                        isDragging = SDL_FALSE;
                    }
                }
            }
            break;
        case SDL_MOUSEMOTION:
            if (isDragging)
            {
                move_rect(event.motion.x, event.motion.y, v_rects1[chosen_index]);
            }
            break;
        }
    }
    return 1;
}
void graphics::close()
{
    SDL_DestroyRenderer(renderer);
    SDL_DestroyWindow(window);
    SDL_Quit();
}

bool graphics::check_mouse(int X, int Y, std::vector<SDL_Rect> &rects)
{
    if (rects.empty())
        return false;

    for (long unsigned int i = 0; i < rects.size(); i++)
    {
        if (!choice_of_card_is_made)
        {
            if (X > rects[i].x && X < rects[i].x + rects[i].w && Y > rects[i].y && Y < rects[i].y + rects[i].h)
            {
                chosen_index = i;
                return true;
            }
        }
    }

    return false;
}
bool has_suit(Suit suit, std::vector<card> cards, bool movable_cards[8])
{
    for (int i = 0; i < 8; ++i)
    {
        if (cards[i].c_suit == suit && movable_cards[i])
        {
            return true;
        }
    }
    return false;
}
void graphics::drop_card(int X, int Y)
{

    if (v_hand1.empty() || chosen_index < 0 || chosen_index >= v_hand1.size() || choice_of_card_is_made || !movable_cards[chosen_index])
        return;

    const auto chosen_card = v_hand1[chosen_index];
    const auto chosen_card_suit = chosen_card.c_suit;

    bool cond_1 = X > drop_place.x && X < drop_place.x + drop_place.w && Y > drop_place.y && Y < drop_place.y + drop_place.h && my_turn;
    if (!cond_1)
    {
        v_rects1[chosen_index].x = og[chosen_index].x;
        v_rects1[chosen_index].y = og[chosen_index].y;
        return;
    }
    if (!suit_decided)
    {
        v_rects1[chosen_index].x = 340;
        v_rects1[chosen_index].y = 300;
        movable_cards[chosen_index] = 0;
        cards_array[chosen_index] = 0;
        played_kwaret.push_back(chosen_card.designation);
        send(m_client_fd, chosen_card.designation.c_str(), chosen_card.designation.size(), 0);
    }
    else if (suit_decided && !has_suit(strong_suit, v_hand1, movable_cards))
    {
        v_rects1[chosen_index].x = 340;
        v_rects1[chosen_index].y = 300;
        movable_cards[chosen_index] = 0;
        cards_array[chosen_index] = 0;
        played_kwaret.push_back(chosen_card.designation);
        send(m_client_fd, chosen_card.designation.c_str(), chosen_card.designation.size(), 0);
    }
    else if (suit_decided && chosen_card_suit == strong_suit)
    {
        v_rects1[chosen_index].x = 340;
        v_rects1[chosen_index].y = 300;
        movable_cards[chosen_index] = 0;
        cards_array[chosen_index] = 0;
        played_kwaret.push_back(chosen_card.designation);
        send(m_client_fd, chosen_card.designation.c_str(), chosen_card.designation.size(), 0);
    }
    else
    {
        v_rects1[chosen_index].x = og[chosen_index].x;
        v_rects1[chosen_index].y = og[chosen_index].y;
    }
}

void graphics::move_rect(int X, int Y, SDL_Rect &selected_rect)
{
    if (chosen_index < 0 || chosen_index >= v_rects1.size() || !movable_cards[chosen_index])
        return;

    int dx = X - selected_rect.x - selected_rect.w / 2;
    int dy = Y - selected_rect.y - selected_rect.h / 2;

    selected_rect.x += dx;
    selected_rect.y += dy;
}

void graphics::wait()
{
    SDL_Delay(20);
}
void graphics::reset_variables()
{
    other_player_choosing = 0;
    suit_decided = 0;
    choice_of_card_is_made = 0;
    is_choosing = 0;
    turn_index = -1;
    my_turn = 0;
    bool_render_previous_cards = 0;
    for (int i = 0; i < 8; ++i)
    {
        cards_array[i] = 1;
        movable_cards[i] = 1;
        cards_to_render[i] = 1;
        v_rects1[i].x = og[i].x;
        v_rects1[i].y = og[i].y;
    }
}

std::string graphics::parse(std::string message)
{
    std::cout << message << std::endl;
    std::vector<std::string> p = splitString(message, ',');

    if (p[0] == "new_hand")
    {
        reset_variables();
        other_player_choosing = 0;
        std::string handd = p[1];
        v_hand1 = m_deck.get_hand_from_str(handd);
    }
    else if (p[0] == "end_of_pli")
    {
        suit_decided = 0;
        cards_array[chosen_index] = 1;
        cards_to_render[chosen_index] = 0;
        choice_of_card_is_made = 0;
        bool_render_previous_cards = 1;
        for (int i = 0; i < 4; ++i)
        {
            pre_cards_to_render[i] = played_kwaret[i];
        }
        for (int i = 0; i < 4; ++i)
        {
            played_card[i] = "";
            played_kwaret.clear();
        }
    }
    else if (p[0] == "ekhtar")
    {
        is_choosing = 1;
    }
    else if (p[0] == "your_turn")
    {
        turn_index = -1;
        my_turn = 1;
    }
    else if (p[0] == "game")
    {
        other_player_choosing = 0;
        chosen_game = p[1];
    }
    else if (p[0] == "turn")
    {
        std::string player_index = p[1];
        my_turn = 0;
        turn_index = std::stoi(player_index);
    }
    else if (p[0] == "stanna")
    {
        other_player_choosing = 1;
    }
    else if (p[0] == "exit")
    {
        running = false;
    }
    else if (p[0] == "car_played")
    {
        std::string player_index = p[1];
        int index = std::stoi(player_index);
        std::string card = p[2];
        played_kwaret.push_back(card);
        played_card[index] = card;
    }
    else if (p[0] == "strong_suit")
    {
        std::string card = p[1];
        suit_decided = 1;
        strong_suit = m_deck.get_suit(card);
    }
    else
    {
        std::cout << " not parsed" << std::endl;
    }
    return response;
}
#endif