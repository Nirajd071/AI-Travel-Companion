'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('travel_dna', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      persona_vector: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Normalized feature vector representing user travel preferences'
      },
      persona_labels: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Human-readable labels with scores (e.g., {"foodie": 0.8, "adventurer": 0.6})'
      },
      location_preferences: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Preferred locations, distance tolerance, transport modes'
      },
      category_preferences: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'POI category preferences with weights'
      },
      activity_preferences: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Time preferences, group size, budget range'
      },
      dietary_restrictions: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      accessibility_needs: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      },
      preferred_languages: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: ['en']
      },
      budget_range: {
        type: Sequelize.ENUM('budget', 'mid-range', 'luxury', 'mixed'),
        defaultValue: 'mixed'
      },
      travel_style: {
        type: Sequelize.ENUM('solo', 'couple', 'family', 'group', 'business'),
        defaultValue: 'solo'
      },
      preferred_distance_km: {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        comment: 'Maximum distance in km for recommendations'
      },
      preferred_travel_time_min: {
        type: Sequelize.INTEGER,
        defaultValue: 10,
        comment: 'Maximum travel time in minutes'
      },
      transport_modes: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: ['walking', 'public_transport'],
        comment: 'Preferred transport: walking, cycling, public_transport, driving'
      },
      quiz_responses: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Original quiz responses for recomputation'
      },
      confidence_score: {
        type: Sequelize.DECIMAL(5, 4),
        defaultValue: 0.5,
        comment: 'Confidence in DNA accuracy (0-1)'
      },
      last_updated: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes
    await queryInterface.addIndex('travel_dna', ['user_id'], { unique: true });
    await queryInterface.addIndex('travel_dna', ['confidence_score']);
    await queryInterface.addIndex('travel_dna', ['budget_range']);
    await queryInterface.addIndex('travel_dna', ['travel_style']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('travel_dna');
  }
};
