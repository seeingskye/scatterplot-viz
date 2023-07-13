const handleErrors = (vis, res, options) => {
  // TODO: Validate measure types & allow for either multi dimension or multi measure

  const check = (group, noun, count, min, max) => {
    if (!vis.addError || !vis.clearErrors) return false
    if (count < min) {
      vis.addError({
        title: `Not Enough ${noun}s`,
        message: `This visualization requires ${min === max ? 'exactly' : 'at least'} ${min} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
        group
      })
      return false
    }
    if (count > max) {
      vis.addError({
        title: `Too Many ${noun}s`,
        message: `This visualization requires ${min === max ? 'exactly' : 'no more than'} ${max} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
        group
      })
      return false
    }
    vis.clearErrors(group)
    return true
  }

  const { pivots, dimensions, measure_like: measures } = res.fields

  return (check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots)
    && check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions)
    && check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures))
}

        
const addTextBox = (selection, maxWidth, text, textAlign = "left", verticalAlign = "top", maxHeight = null) => {
    // Set initial max bounding width for foreignObject
    const foreignObject = selection.append('foreignObject')
    foreignObject.attr("width", maxWidth);
    let div = foreignObject.append('xhtml:div')
    let span = div.append('xhtml:span')
      .style('display', "inline-block")
      .html(text)
    let {width: divWidth, height: divHeight} = span.node().getBoundingClientRect();
  
    // Convert coordinate system if viewPort is different
    const ctm = foreignObject.node().getCTM().inverse();
    const objWidth = divWidth * ctm.a;
    const objHeight = (maxHeight && divHeight > maxHeight ? maxHeight : divHeight) * ctm.d;
    
    // Set foreignObject to new minimum width
    foreignObject
      .attr("width", objWidth);
    
  
    if (textAlign === "center") {
      div.style('text-align', "center");
      foreignObject.attr('x', -objWidth /2);
    }
    
    if (verticalAlign === "middle") {
      foreignObject.attr('y', -objHeight / 2)
    }
    else if (verticalAlign === "bottom") {
      foreignObject.attr('y', -objHeight)
    }
    
    foreignObject.attr("height", objHeight);
  
    return {width: objWidth, height: objHeight};
  }
  
  const formatFields = (responseObj) => {
    // Create obj to lookup field details by name
    const rawFields = responseObj.fields;
    const combinedFields = rawFields.dimension_like.concat(rawFields.measure_like);
    const fieldsArray = combinedFields.map((field) => [field.name, field]);
    const fields = Object.fromEntries(fieldsArray);
  
    return fields
  }
  
  
  function formatType(valueFormat) {
    if (typeof valueFormat != "string") {
      return function (x) {return x}
    }
    let format = ""
    switch (valueFormat.charAt(0)) {
      case '$':
        format += '$'; break
      case '£':
        format += '£'; break
      case '€':
        format += '€'; break
    }
    if (valueFormat.indexOf(',') > -1) {
      format += ','
    }
    splitValueFormat = valueFormat.split(".")
    format += '.'
    if (splitValueFormat.at(-1).at(-1) == "%") {
      format += splitValueFormat.at(-1).length - 1;
      format += '%';
    } else {
      format += splitValueFormat.at(-1).length;
      format += 'f';
    }
    
    return d3.format(format)
  }
  
  const formatField = (value, defaultFormat, configFormat = "") => {
    const format = configFormat != "" ? configFormat : defaultFormat;
    return formatType(format)(value);
  }
    
  const visObject = {
      /**
       * Configuration options
       **/
       options: {
          bubble_color: {
            section: "Chart",
            order: 1,
            label: 'Bubble: Gradient Color',
            type: 'array',
            display: 'color',
            display_size: 'half',
            default: ["#963CBD"]
          },
          bubble_max_font_size: {
            section: "Chart",
            order: 2,
            label: 'Bubble: Max Font Size',
            type: 'number',
            display: 'number',
            default: 16
          },
          legend_font_size: {
            section: "Chart",
            order: 3,
            label: 'Legends: Font Size',
            type: 'number',
            display: 'number',
            default: 16
          },
          color_legend_value_format: {
            section: "Chart",
            order: 4,
            label: 'Color Legend: Value Format',
            type: 'string',
            display: 'text',
            default: ""
          },
          x_axis_field: {
            section: "Series",
            order: 1,
            label: 'X-Axis Field',
            type: 'string',
            display: 'select',
            default: "test",
            values: [
              {"test": "test"},
              {"test2": "test2"}
            ]
          },
          x_axis_field_value_format: {
            section: "Series",
            order: 2,
            label: 'X-Axis Field: Value Format',
            type: 'string',
            display: 'text',
            default: ""
          },
          y_axis_field: {
            section: "Series",
            order: 3,
            label: 'Y-Axis Field',
            type: 'string',
            display: 'select',
            default: "test",
            values: [
              {"test": "test"},
              {"test2": "test2"}
            ]
          },
          y_axis_field_value_format: {
            section: "Series",
            order: 4,
            label: 'Y-Axis Field: Value Format',
            type: 'string',
            display: 'text',
            default: ""
          },
          color_category_field: {
            section: "Series",
            order: 5,
            label: 'Color Category Field',
            type: 'string',
            display: 'select',
            default: "test",
            values: [
              {"test": "test"},
              {"test2": "test2"}
            ]
          },
       },
      
      /**
       * The create function gets called when the visualization is mounted but before any
       * data is passed to it.
       **/
        create: function(element, config){
          this.svg = d3.select(element).append('svg');
        },
     
      /**
       * UpdateAsync is the function that gets called (potentially) multiple times. It receives
       * the data and should update the visualization with the new data.
       **/
        updateAsync: function(data, element, config, queryResponse, details, doneRendering){
          this.trigger("loadingStart");
          
          this.clearErrors();
          if (!handleErrors(this, queryResponse, {
             min_pivots: 0, max_pivots: 0,
             min_dimensions: 1, max_dimensions: 1,
             min_measures: 1, max_measures: 2
          })) return
  
          const fields = formatFields(queryResponse);
  
          // ****************** CONFIGS ***************************
          const fieldNames = Object.keys(fields);
  
          const fieldOptions = Object.entries(fields).map((key, value) => Object.fromEntries([[value.label_short, key]]));
  
          this.options.x_axis_field = {
            section: "Series",
            order: 2,
            label: 'X-Axis Field',
            type: 'string',
            display: 'select',
            default: "pdt_commitment_facts.average_rating_change_percentage",
            values: fieldOptions
          }
          this.options.y_axis_field = {
            section: "Series",
            order: 4,
            label: 'Y-Axis Field',
            type: 'string',
            display: 'select',
            default: "commitment.total_commitments",
            values: fieldOptions
          }
          this.options.color_category_field = {
            section: "Series",
            order: 5,
            label: 'Color Category Field',
            type: 'string',
            display: 'select',
            default: "program_impact_area.impact_area",
            values: fieldOptions
          }
          
          this.trigger('registerOptions', this.options)
          
  
          const getConfigValue = (configName) => {
            const options = this.options[configName];
            if (!config) return options.default
  
            const currentValue = config[configName];
            if (options.type == 'string' && options.display == 'select') {
              const newValue =  fieldNames.includes(currentValue) ? currentValue : options.default;
              this.trigger("updateConfig", [{configName: newValue}]);
  
              return newValue;
            }
  
            const newValue = (currentValue != undefined) ? currentValue : options.default;
            return newValue
          }
          const configColor = getConfigValue('bubble_color');
          const lightColor = d3.hcl(d3.rgb(configColor));
          lightColor.l = 90;
          lightColor.c = 5;
          const configColors = [configColor, lightColor]
          const bubbleColors = d3.interpolateRgbBasis(configColors);
          const bubble_max_font_size = getConfigValue('bubble_max_font_size');
          const legend_font_size = getConfigValue('legend_font_size');
          const color_legend_value_format = getConfigValue('color_legend_value_format');
          const y_axis_field = getConfigValue('y_axis_field');
          const x_axis_field = getConfigValue('x_axis_field');
          const color_category_field = getConfigValue('color_category_field');
          const x_axis_field_value_format = getConfigValue('x_axis_field_value_format');
          const y_axis_field_value_format = getConfigValue('y_axis_field_value_format');
  
          // SVG
          const margin = { y: 10, x: 10};
    
          const svg = this.svg
            .html('')
            .attr('x', 0)
            .attr('y', 0)
            .style('font-family', "Open Sans, Helvetica, Arial, sans-serif")
    
          const vizNode = svg.append('g');
          const gNode = vizNode.append("g")
              .style("font-size", `${bubble_max_font_size}px`);
          const gLegend = vizNode.append("g")
              .style("font-size", `${legend_font_size}px`);
          const defs = svg.append("defs");
  
          const vizGradient = defs.append("linearGradient")
            .attr("id", "vizGradient")
            .attr('gradientTransform', "rotate(90)")
  
            const colorCount = configColors.length - 1;
            configColors.forEach((color, i) => {
              vizGradient.append('stop')
                .attr('offset', `${100 * (i / colorCount)}%`)
                .attr('stop-color', `${color}`)
            })
          
          
          // ****************** tooltip section ***************************
          const tooltip = svg.append('g')
            .style("visibility", "hidden")
            .style("line-height", "1.2em")
            .style("font-size", ".9em");
          
          const tooltipMargin = 10;
          tooltip.append('rect')
            .attr('x', -tooltipMargin)
            .attr('y', -tooltipMargin)
            .attr('rx', 5)
            .attr('ry', 5)
            .style('fill', "hsl(0 0% 95% / .97)")
            // .style('stroke', "black")
            // .style('stroke-width', 1)
            .style('opacity', .97)
  
          const mouseOverTooltip = function(event, d) {
            d3.select(this).select('circle')
              .style('filter', "drop-shadow(-2px 2px 0.2rem grey)")
            
            tooltip
              .style('visibility', "visible")
              .selectAll('foreignObject').remove();
            const text = `<legend>${color_category_field ? LookerCharts.Utils.textForCell(d[color_category_field]) : ""}</legend>
              <dl><dt style="font-size:.9em">${fields[x_axis_field].label_short}<b></b></dt>
              <dd><b>${formatField(d[x_axis_field].value, fields[x_axis_field].value_format, x_axis_field_value_format)}</b></dd>
              <dt style="font-size:.9em">${fields[y_axis_field].label_short}</dt>
              <dd><b>${formatField(d[y_axis_field].value, fields[y_axis_field].value_format, y_axis_field_value_format)}</b></dd></dl>`;
            const {width: width, height: height} = addTextBox(tooltip, 300, text, "left", "top");
  
            tooltip.select('rect')
            .attr('width', width + tooltipMargin*2)
            .attr('height', height + tooltipMargin*2)
  
          }
  
          const transformToViewBoxCoords = (x, y) => {
            
            const ctm = svg.node().getScreenCTM().inverse();
            transformedX = (x  * ctm.a) + ctm.e;
            transformedY = (y * ctm.d) + ctm.f;
            return [transformedX, transformedY]
          }
  
          const mouseMoveTooltip = (event) => {
            const {clientX, clientY} = event;
            const [currentX, currentY] = transformToViewBoxCoords(clientX, clientY);
            const tooltipHeight = tooltip.node().getBBox().height;
            tooltip
              .attr('transform', `translate(${currentX + 40}, ${currentY - tooltipHeight/2 + 10})`);
          }
  
          const mouseOutTooltip = function() {
            d3.select(this).select('circle')
              .style('filter', "")
            
            tooltip.style('visibility', "hidden")
          }
       
          // ****************** nodes section ***************************
  
          // TODO: currently only funtions for number values, doesn't take dimensions
          // Needs to check field type
          const height = element.clientHeight;
          const width = element.clientWidth;
  
          const x = d3.scaleLinear()
              .domain(d3.extent(data, d => d[x_axis_field].value)).nice()
              .range([0, width]);
  
          const y = d3.scaleLinear()
              .domain(d3.extent(data, d => d[y_axis_field].value)).nice()
              .range([height, 0]);
  
          // Create the axes.
          vizNode.append("g")
              .attr("transform", `translate(0,${height})`)
              .call(d3.axisBottom(x).ticks(width / 80))
              .call(g => g.select(".domain").remove())
              .call(g => g.append("text")
                  .attr("x", width)
                  .attr("y", 35)
                  .attr("fill", "black")
                  .attr("text-anchor", "end")
                  .text(fields[x_axis_field].label_short));
  
          vizNode.append("g")
              .attr("transform", `translate(0,0)`)
              .call(d3.axisLeft(y))
              .call(g => g.select(".domain").remove())
              .call(g => g.append("text")
                  .attr("x", -20)
                  .attr("y", -15)
                  .attr("fill", "black")
                  .attr("text-anchor", "start")
                  .text(fields[y_axis_field].label_short));
          
          // Create the grid.
          vizNode.append("g")
              .attr("stroke", "black")
              .attr("stroke-opacity", 0.1)
              .call(g => g.append("g")
                  .selectAll("line")
                  .data(x.ticks())
                  .join("line")
                  .attr("x1", d => 0.5 + x(d))
                  .attr("x2", d => 0.5 + x(d))
                  .attr("y1", 0)
                  .attr("y2", height))
              .call(g => g.append("g")
                  .selectAll("line")
                  .data(y.ticks())
                  .join("line")
                  .attr("y1", d => 0.5 + y(d))
                  .attr("y2", d => 0.5 + y(d))
                  .attr("x1", 0)
                  .attr("x2", width));
          
          vizNode.append("g")
              .attr("fill", "steelblue")
              .attr("fill-opacity", .4)
              .attr("stroke", "steelblue")
              .attr("stroke-width", 1)
          .selectAll("circle")
          .data(data)
          .join("circle")
              .attr("cx", d => x(d[x_axis_field].value))
              .attr("cy", d => y(d[y_axis_field].value))
              .attr("r", 3)
              .on('mouseover', mouseOverTooltip)
              .on('mousemove', mouseMoveTooltip)
              .on('mouseout', mouseOutTooltip);
          
          // let root = {children: data}; 
          // const flat_node_heirarchy = d3.hierarchy(root)
          //   .sum(d => Object.hasOwn(d, y_axis_field) ? d[y_axis_field].value : 0)
          //   .sort((a, b) => b.value - a.value);
  
          // const pack = d3.pack()
          //     .size([element.clientWidth, element.clientHeight])
          //     .padding(3)
          // const packed_data = pack(flat_node_heirarchy);
          // const leaves = packed_data.leaves();
  
          // // Prep supplementary attributes for data
          // const x_axis_field_values = leaves.map(leaf => leaf.data[x_axis_field].value);
          // const x_axis_field_min = Math.min(...x_axis_field_values);
          // const x_axis_field_max = Math.max(...x_axis_field_values);
          // const x_axis_field_range = x_axis_field_max - x_axis_field_min;
  
          // const radius_values = leaves.map(leaf => leaf.r);
          // const radius_max = Math.max(...radius_values);
          
  
          // leaves.forEach((leaf) => {
          //   const colorValue = leaf.data[x_axis_field].value;
          //   if (x_axis_field_range === 0) {  // If all values are the same
          //       leaf.color = bubbleColors(.5)
          //   } else {
          //       leaf.color = bubbleColors(1- ((colorValue - x_axis_field_min) / x_axis_field_range))
          //   }
  
          //   const fontSizeScalar = .5;
          //   leaf.fontSize = 1 - ((radius_max - leaf.r) * fontSizeScalar / radius_max);
          // })
  
  
          // const node = gNode.selectAll("g")
          //   .data(packed_data.leaves());
         
          // const node_enter = node.enter().append('g')
          //     .attr('transform', (d) => `translate(${d.x}, ${d.y})`)
          //     .style('font-size', (d) => `${d.fontSize}em`)
          //     .style('hyphens', "auto")
          //     .style('overflow-wrap', "anywhere")
          //     .style('text-overflow', "ellipsis")
          //     .on('mouseover', mouseOverTooltip)
          //     .on('mousemove', mouseMoveTooltip)
          //     .on('mouseout', mouseOutTooltip);
          
          //     node_enter.append("circle")
          //     .attr('r', d => d.r)
          //     .attr('fill', d => d.color)
              
  
          //     node_enter.each(function(d) {
          //       const width = d.r * 2;
          //       const text = LookerCharts.Utils.htmlForCell(d.data[color_category_field]);
          //       const nodeEnter = d3.select(this);
          //       nodeEnter.call(addTextBox, width, text, "center", "middle", width);
          //     })
  
          //     node_enter.select("foreignObject")
          //       .style('clip-path', d => `circle(${d.r}px)`);
          
          
          // ****************** legend section ***************************
          // const labelWidth = 150;
          // const legend_bar_width = 30;
          // const legend_bar_height = element.clientHeight *.75;
  
          // const nodeBBox = gNode.node().getBBox();
          // const minX = nodeBBox.x + nodeBBox.width;
          
          // const legendX = minX + labelWidth;
          // const legendY = (element.clientHeight - legend_bar_height + 20) / 2;
  
          // const colorLegend = gLegend.append("g")
          //   .attr('transform', `translate(${legendX}, ${legendY})`)
          
          // colorLegend.append("rect")
          //   .attr('x', (legend_bar_width * .2) - legend_bar_width/2)
          //   .attr('width', legend_bar_width * .7)
          //   .attr('height', legend_bar_height)
          //   // .style('stroke', "black")
          //   .style('fill', "url(#vizGradient)")
  
          // colorLegend.append('g')
          //   .call(addTextBox, labelWidth, fields[x_axis_field].label_short, "center", "bottom")
          //   .attr("transform", "translate(0,-20)")
          
          // colorLegend.append("path")
          //   .attr('d', 
          //     `m${-legend_bar_width/2},0
          //     l${legend_bar_width},0
          //     m-${legend_bar_width},${legend_bar_height/4}
          //     l${legend_bar_width/4},0
          //     m-${legend_bar_width/4},${legend_bar_height/4}
          //     l${legend_bar_width/4},0
          //     m-${legend_bar_width/4},${legend_bar_height/4}
          //     l${legend_bar_width/4},0
          //     m-${legend_bar_width/4},${legend_bar_height/4}
          //     l${legend_bar_width},0`)
          //   .attr('stroke', "black")
          //   .attr('stroke-width', 2)
       
          // for (let i = 0; i < 5; i++) {
          //   const pipValue = x_axis_field_min + ((x_axis_field_range / 4) * i);
  
          //   colorLegend.append("text")
          //   .text(formatField(pipValue, fields[x_axis_field].value_format, color_legend_value_format)) 
          //   .attr('x', -3 - legend_bar_width/2)
          //   .attr('y', legend_bar_height - ((legend_bar_height / 4) * i))
          //   .style('text-anchor', "end")
          //   .style('dominant-baseline', "middle")
          //   .style('font-size', ".9em")
          // }
  
          // const sizeLegend = gLegend.append('g')
          //   .attr('transform', `translate(${legendX}, ${legend_bar_height + legendY + 20})`)
          //   .call(addTextBox, labelWidth, `<b>Size:</b> <br> ${fields[y_axis_field].label_short}`, "center", "top")
  
          // ****************** viz viewbox section ***************************
  
           const vizNodeRect = vizNode.node().getBBox();
           const viewBox = {
             'x': vizNodeRect.x - margin.x,
             'y': vizNodeRect.y - margin.y,
             'width': vizNodeRect.width + margin.x*2,
             'height': vizNodeRect.height + margin.y*2
           };
           svg
             .attr('width', element.clientWidth)
             .attr('height', element.clientHeight)
             .attr('viewBox', `${viewBox.x}, ${viewBox.y}, ${viewBox.width}, ${viewBox.height}`)
             .attr('preserveAspectRatio', "xMidYMid meet")
  
             this.trigger("loadingEnd");
             doneRendering();
         }
     };
     
     looker.plugins.visualizations.add(visObject);