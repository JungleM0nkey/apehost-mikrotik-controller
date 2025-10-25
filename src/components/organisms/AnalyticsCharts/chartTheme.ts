/**
 * Dark theme configuration for Ant Design Charts
 * Matches the app's design system tokens
 */

export const darkChartTheme = {
  // Orange color palette matching app design system
  colors10: [
    '#ff6b35', // Primary orange
    '#ff8c61', // Light orange
    '#f97316', // Medium orange
    '#fb923c', // Peachy orange
    '#ff9f66', // Lighter peachy
    '#ea580c', // Dark orange
    '#fdba74', // Very light orange
    '#ff4500', // Red-orange
    '#c2410c', // Deep orange
    '#fed7aa', // Pale orange
  ],

  // Background colors
  backgroundColor: 'transparent',

  // Global styles
  styleSheet: {
    backgroundColor: 'transparent',
    brandColor: '#ff6b35',
    paletteQualitative10: [
      '#ff6b35',
      '#ff8c61',
      '#f97316',
      '#fb923c',
      '#ff9f66',
      '#ea580c',
      '#fdba74',
      '#ff4500',
      '#c2410c',
      '#fed7aa',
    ],
    paletteQualitative20: [
      '#ff6b35',
      '#ff8c61',
      '#f97316',
      '#fb923c',
      '#ff9f66',
      '#ea580c',
      '#fdba74',
      '#ff4500',
      '#c2410c',
      '#fed7aa',
      '#ff5722',
      '#ff7849',
      '#fd7e14',
      '#ff9966',
      '#f4a460',
      '#d2691e',
      '#ff6347',
      '#ff8c00',
      '#ff7f50',
      '#ffb74d',
    ],
  },

  // Component themes
  components: {
    axis: {
      common: {
        line: {
          style: {
            stroke: '#2d2d2d',
            lineWidth: 1,
          },
        },
        label: {
          style: {
            fill: '#a0a0a0',
            fontSize: 12,
          },
        },
        title: {
          style: {
            fill: '#ffffff',
            fontSize: 14,
            fontWeight: 500,
          },
        },
      },
      top: {
        grid: {
          line: {
            style: {
              stroke: '#2d2d2d',
              lineWidth: 0.5,
              lineDash: [4, 4],
            },
          },
        },
      },
      bottom: {
        grid: {
          line: {
            style: {
              stroke: '#2d2d2d',
              lineWidth: 0.5,
              lineDash: [4, 4],
            },
          },
        },
      },
      left: {
        grid: {
          line: {
            style: {
              stroke: '#2d2d2d',
              lineWidth: 0.5,
              lineDash: [4, 4],
            },
          },
        },
      },
      right: {
        grid: {
          line: {
            style: {
              stroke: '#2d2d2d',
              lineWidth: 0.5,
              lineDash: [4, 4],
            },
          },
        },
      },
    },
    legend: {
      common: {
        itemName: {
          style: {
            fill: '#ffffff',
            fontSize: 12,
          },
        },
        marker: {
          style: {
            r: 5,
          },
        },
      },
    },
    tooltip: {
      domStyles: {
        'g2-tooltip': {
          backgroundColor: '#1f1f1f',
          color: '#ffffff',
          border: '1px solid #2d2d2d',
          borderRadius: '6px',
          padding: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
        },
        'g2-tooltip-title': {
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '8px',
        },
        'g2-tooltip-list-item': {
          color: '#a0a0a0',
          fontSize: '12px',
          lineHeight: '20px',
        },
        'g2-tooltip-marker': {
          borderRadius: '50%',
        },
        'g2-tooltip-value': {
          color: '#ffffff',
          fontWeight: 500,
        },
      },
    },
    label: {
      style: {
        fill: '#ffffff',
        fontSize: 12,
      },
    },
  },
};

/**
 * Common chart configuration for dark theme
 */
export const getCommonChartConfig = () => ({
  theme: darkChartTheme,
  appendPadding: [10, 0, 0, 0],
  animation: {
    appear: {
      duration: 1000,
    },
  },
});
